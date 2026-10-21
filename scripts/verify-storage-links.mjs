// Read-only verification. Token-bearing proposal URLs are never written to output.
// Node 24: --env-file=.env.local scripts/verify-storage-links.mjs <origin> <label>
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const [origin = "https://staypack.app", label = "production"] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid evidence label");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const records = new Map((await readFile("tmp/r2-migration/manifest.jsonl", "utf8")).trim().split("\n").map(line => { const row = JSON.parse(line); return [row.key, row]; }));
const evidence = { origin, checkedAt: new Date().toISOString(), proposals: [], reports: [], attachments: [], legacyPublicPdfs: 0, failures: [] };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const links = checked(await admin.from("digital_proposal_links")
  .select("id,token,version:digital_proposal_versions!inner(id,agency_id,report_id,pdf_status,pdf_path,report:reports!inner(agency_id,listing:listings!inner(agency_id)))")
  .is("revoked_at", null).is("version.revoked_at", null).neq("version.report.status", "archived").neq("version.report.listing.status", "archived"));
const pdfs = links.filter(link => link.version.pdf_status === "ready" && records.has(`proposal-pdfs/${link.version.pdf_path}`))
  .sort((a, b) => records.get(`proposal-pdfs/${a.version.pdf_path}`).size - records.get(`proposal-pdfs/${b.version.pdf_path}`).size);
const samples = [...new Map([pdfs[0], pdfs[Math.floor(pdfs.length / 2)], pdfs.at(-1)].filter(Boolean).map(l => [l.id, l])).values()];
for (const link of samples) {
  try {
    const page = await fetch(`${origin}/proposal/${link.token}`, { signal: AbortSignal.timeout(90_000) });
    assert.equal(page.status, 200, "Existing proposal page unavailable");
    const html = await page.text(); assert.ok(html.length > 1000);
    const response = await fetch(`${origin}/api/proposals/${link.token}/pdf`, { signal: AbortSignal.timeout(90_000) });
    assert.equal(response.status, 200, "Existing proposal PDF unavailable");
    assert.match(response.headers.get("cache-control") || "", /private.*no-store/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(hash(bytes), records.get(`proposal-pdfs/${link.version.pdf_path}`).sha256, "PDF checksum differs");
    evidence.proposals.push({ versionId: link.version.id, size: bytes.length, sha256: hash(bytes), pageStatus: 200, pdfStatus: 200 });
  } catch (error) { evidence.failures.push({ type: "proposal", id: link.version.id, message: error.message }); }
}
const invalid = await fetch(`${origin}/api/proposals/${"0".repeat(64)}/pdf`);
assert.equal(invalid.status, 404, "Invalid proposal token should not grant access");
evidence.invalidTokenStatus = invalid.status;
const attachments = checked(await admin.from("digital_proposal_attachments").select("id,report_id,agency_id,storage_path"));
for (const attachment of attachments) {
  const link = links.find(l => l.version.report_id === attachment.report_id && l.version.agency_id === attachment.agency_id);
  if (!link || !records.has(`proposal-documents/${attachment.storage_path}`)) continue;
  const response = await fetch(`${origin}/api/proposals/${link.token}/attachments/${attachment.id}`);
  // A document must also be included in the immutable version, so skip unpublished attachments.
  if (response.status === 404) continue;
  assert.equal(response.status, 200);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(hash(bytes), records.get(`proposal-documents/${attachment.storage_path}`).sha256);
  evidence.attachments.push({ id: attachment.id, status: response.status, sha256: hash(bytes) });
}
const reports = checked(await admin.from("reports").select("id,public_slug,agency:agencies!inner(slug)").eq("status", "published").not("public_slug", "is", null).limit(5));
for (const report of reports) {
  const response = await fetch(`${origin}/${report.agency.slug}/${report.public_slug}`);
  if (response.status !== 200) evidence.failures.push({ type: "report", id: report.id, status: response.status });
  else evidence.reports.push({ id: report.id, status: response.status });
  await response.arrayBuffer();
}
const publicPdfs = [...records.values()].filter(row => row.bucket === "report-pdfs");
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < publicPdfs.length) {
    const row = publicPdfs[next++];
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${row.key.split("/").map(encodeURIComponent).join("/")}`;
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) });
    if (response.status !== 200 || Number(response.headers.get("content-length")) !== row.size) evidence.failures.push({ type: "legacy-public-pdf", key: row.key, status: response.status });
    else evidence.legacyPublicPdfs++;
  }
}));
await writeFile(`tmp/r2-migration/links-${label}.json`, JSON.stringify(evidence, null, 2), { mode: 0o600 });
console.log(JSON.stringify(evidence));
assert.equal(evidence.failures.length, 0, "Link checks failed; do not clean up originals");
assert.ok(evidence.proposals.length > 0 && evidence.reports.length > 0 && evidence.legacyPublicPdfs > 0);
