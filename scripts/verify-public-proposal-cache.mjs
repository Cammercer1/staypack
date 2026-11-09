// Run after npm run build, inside the development container. Uses synthetic data only.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";

const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), "staypack-public-cache-"));
const stateFile = join(directory, "state.json"), readsFile = join(directory, "reads.jsonl");
const id = randomUUID(), token = id.replaceAll("-", "").repeat(2), slug = `cache-test/${id}`;
const secret = `PRIVATE_REPORT_${id}`;
const port = Number(process.env.STAYPACK_CACHE_TEST_PORT || 3401);
const { outputFiles } = await build({
  stdin: { contents: `import { createProposalFixture } from './lib/digital-proposals/fixtures';
    import { DEFAULT_PROPOSAL_DRAFT } from './lib/digital-proposals/template';
    import { BRAND_DEFAULTS } from './lib/digital-proposals/brand';
    export const snapshot = { version: 1, data: createProposalFixture(), draft: {...DEFAULT_PROPOSAL_DRAFT, templateId:'property-providers'}, brand: BRAND_DEFAULTS, attachments: [] };`,
  resolveDir: root, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false,
});
const fixtureFile = join(directory, "fixture.cjs");
await writeFile(fixtureFile, outputFiles[0].text);
const { snapshot } = createRequire(import.meta.url)(fixtureFile);
snapshot.data.property.address = secret;
snapshot.data.agency = { name: "Cache test agency", logoUrl: "/next.svg" };
await writeFile(stateFile, JSON.stringify({ revoked: false, failure: false, snapshot }));
await writeFile(readsFile, "");
const preload = join(directory, "preload.cjs");
await writeFile(preload, `
const fs = require('node:fs');
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input);
  if (!url.pathname.startsWith('/rest/v1/')) return original(input, init);
  const state = JSON.parse(fs.readFileSync(${JSON.stringify(stateFile)}, 'utf8'));
  const select = url.searchParams.get('select') || '';
  const branding = select.includes('name:final_report_json');
  const content = !branding && (select === 'final_report_json' || select.startsWith('version:final_report_json'));
  const kind = branding ? 'brand' : content ? 'content' : 'access';
  const example = url.pathname.endsWith('/prospect_proposals');
  fs.appendFileSync(${JSON.stringify(readsFile)}, JSON.stringify({kind, example}) + '\\n');
  if (kind === 'access') {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (state.failure) return Response.json({error:'synthetic outage'}, {status:503});
    if (state.revoked) return Response.json([]);
  }
  const s = state.snapshot, id = ${JSON.stringify(id)};
  if (branding) {
    const brand = {name:s.data.agency.name, logoUrl:s.data.agency.logoUrl, primary:s.brand.primary, primaryText:s.brand.primaryText};
    return Response.json(example ? [brand] : [{version:brand}]);
  }
  if (content) return Response.json(example ? [{final_report_json:s}] : [s]);
  if (example) return Response.json([{id, public_slug:${JSON.stringify(slug)}, published_at:'2026-11-09T00:00:00Z'}]);
  const version = {id, agency_id:id, report_id:id, content_hash:'test-hash', pdf_status:'pending', pdf_path:null, report:{agency_id:id, listing:{agency_id:id}}};
  return Response.json(url.pathname.endsWith('/digital_proposal_link_versions') ? [{link:{id},version}] : [{id,version}]);
};
`);
let logs = "";
const child = spawn(process.execPath, ["--require", preload, "node_modules/next/dist/bin/next", "start", "--port", String(port), "--hostname", "127.0.0.1"], {
  cwd: root, env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", value => { logs += value; });
child.stderr.on("data", value => { logs += value; });
const reads = async () => (await readFile(readsFile, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
const setState = async patch => {
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  await writeFile(stateFile, JSON.stringify({ ...state, ...patch }));
};
async function request(pathname, rsc = false) {
  const start = performance.now();
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { headers: { "user-agent": "Mozilla/5.0 Chrome/145.0.0.0 Safari/537.36", ...(rsc ? { RSC: "1" } : {}) }, redirect: rsc ? "follow" : "manual" });
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  let html = "", shellAt, reportAt;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    html += decoder.decode(chunk, { stream: true });
    if (shellAt === undefined && html.includes('data-testid="proposal-loading"')) shellAt = performance.now() - start;
    if (reportAt === undefined && html.includes(secret)) reportAt = performance.now() - start;
  }
  return { html, shellAt, reportAt };
}
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { clearInterval(interval); reject(new Error(`Server did not start: ${logs}`)); }, 30_000);
    const interval = setInterval(() => {
      if (logs.includes("Ready")) { clearInterval(interval); clearTimeout(timeout); resolve(); }
      else if (child.exitCode !== null) { clearInterval(interval); clearTimeout(timeout); reject(new Error(logs)); }
    }, 100);
  });
  for (const [label, pathname, alias, example] of [
    ["example", `/examples/${slug}`, `/example/${token}`, true],
    ["customer proposal", `/proposal/${token}`, `/proposal/${token}?version=${id}`, false],
  ]) {
    await setState({ revoked: false, failure: false });
    const first = await request(pathname);
    assert.ok(first.html.includes(secret), `${label}: first load renders the report`);
    const warm = await request(pathname);
    assert.ok(warm.shellAt < 400 && warm.reportAt >= 500, `${label}: branded shell must stream before live authorization (${JSON.stringify({shell: warm.shellAt, report: warm.reportAt})})`);
    assert.ok(warm.html.includes("Cache test agency"));
    await request(alias);
    let captured = (await reads()).filter(row => row.example === example);
    assert.equal(captured.filter(row => row.kind === "content").length, 1, `${label}: frozen content really uses Next's cache across visits/aliases`);
    assert.equal(captured.filter(row => row.kind === "access").length, 3, `${label}: every visit performs one live access check`);
    const navigation = await request(pathname, true);
    assert.ok(navigation.html.includes(secret), `${label}: authorized client navigation resolves the report`);
    await setState({ revoked: true });
    for (const path of [pathname, alias]) {
      const revoked = await request(path);
      assert.ok(!revoked.html.includes(secret), `${label}: revoked content must never appear in HTML, RSC or metadata`);
      assert.match(revoked.html, /404|NEXT_HTTP_ERROR_FALLBACK/);
    }
    const revokedNavigation = await request(pathname, true);
    assert.ok(!revokedNavigation.html.includes(secret), `${label}: client navigation cannot recover a revoked report`);
    assert.match(revokedNavigation.html, /404|NEXT_HTTP_ERROR_FALLBACK/);
    await setState({ revoked: false, failure: true });
    const failed = await request(pathname);
    assert.ok(!failed.html.includes(secret), `${label}: database failure must not serve stale authorized content`);
    captured = (await reads()).filter(row => row.example === example);
    assert.equal(captured.filter(row => row.kind === "content").length, 1);
    console.log(`${label}: branded shell ${Math.round(warm.shellAt)}ms, live check + report ${Math.round(warm.reportAt)}ms; cache, aliases, revocation and outage checks passed`);
  }
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise(resolve => child.once("exit", resolve));
  }
  await rm(directory, { recursive: true, force: true });
}
