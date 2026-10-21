/** Node 24 + tsx, with .env.local loaded. prepare copies files only; apply changes
 * image URLs after readback verification. verify checks stored snapshots and links.
 * Private backups include share tokens: keep tmp/proposal-image-preservation ignored.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2Client, r2Configuration } from "../lib/storage/r2";
import { preserveProposalImages, type ProposalImage } from "../lib/digital-proposals/imageStorage";
import { proposalImageUrls, replaceProposalImages } from "../lib/digital-proposals/imageSnapshot";
import { fetchExportImage } from "../lib/collateral/social/fetchExportImage";

type Table = "digital_proposal_versions" | "prospect_proposals";
type Row = { id: string; final_report_json: unknown; agency_id?: string; brand_id?: string; report_id?: string; content_hash?: string; [key: string]: unknown };
type Entry = { table: Table; original: Row; snapshot: unknown; hash: string; replacements: [string, string][] };
const root = "tmp/proposal-image-preservation";
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
async function save(path: string, value: unknown) { await writeFile(`${root}/${path}`, JSON.stringify(value, null, 2), { mode: 0o600 }); }
async function load<T>(path: string): Promise<T> { return JSON.parse(await readFile(`${root}/${path}`, "utf8")); }
const rowFile = (table: Table, id: string) => `rows/${table}-${id}.json`;
const keyCache = new Map<string, Promise<string[]>>();
// Explicitly reviewed recoveries for already-broken original URLs. Each local
// file is checksum-bound and records its source and reason in the private audit.
type Recovery = { file: string; sha256: string; source: string; reason: string };
let recoveries: Record<string, Recovery> = {};
async function mirrorKeys(agency: string) {
  if (!keyCache.has(agency)) keyCache.set(agency, (async () => {
    const keys: string[] = []; let ContinuationToken: string | undefined;
    do {
      const page = await r2Client().send(new ListObjectsV2Command({ Bucket: r2Configuration().publicBucket, Prefix: `report-assets/${agency}/`, ContinuationToken }));
      keys.push(...(page.Contents ?? []).map(item => item.Key!)); ContinuationToken = page.NextContinuationToken;
    } while (ContinuationToken);
    return keys;
  })());
  return keyCache.get(agency)!;
}
async function storedImage(Key: string): Promise<ProposalImage | null> {
  try {
    const object = await r2Client().send(new GetObjectCommand({ Bucket: r2Configuration().publicBucket, Key }));
    assert.ok(object.ContentLength && object.ContentLength <= 12 * 1024 * 1024);
    return { buffer: Buffer.from(await object.Body!.transformToByteArray()), contentType: object.ContentType || "image/jpeg" };
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}
async function recovery(row: Row, source: string) {
  const reviewed = recoveries[source];
  if (reviewed) {
    assert.match(reviewed.file, /^recovered\/[a-zA-Z0-9._-]+$/);
    assert.ok(reviewed.source && reviewed.reason);
    const buffer = await readFile(`${root}/${reviewed.file}`);
    assert.equal(digest(buffer), reviewed.sha256, "Reviewed recovery changed");
    return { buffer, contentType: "application/octet-stream" };
  }
  const keys = row.agency_id ? await mirrorKeys(row.agency_id) : [];
  const sourceHash = digest(source).slice(0, 16);
  const matches = keys.filter(key => key.includes(`/pdf-images/${sourceHash}.`));
  const own = matches.find(key => key.startsWith(`report-assets/${row.agency_id}/${row.id}/`));
  if (own) return storedImage(own);
  const absolute = new URL(source, "https://staypack.app");
  // Original Supabase files were copied to the same logical key in the R2 migration.
  const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (absolute.origin === supabase.origin && absolute.pathname.startsWith("/storage/v1/object/public/")) {
    const copy = await storedImage(decodeURIComponent(absolute.pathname.slice("/storage/v1/object/public/".length)));
    if (copy) return copy;
  }
  try { return await fetchExportImage(absolute.toString()); }
  catch (error) {
    const fallback = matches.find(key => key.startsWith(`report-assets/${row.agency_id}/${row.report_id}/`)) ?? matches[0];
    if (fallback) return storedImage(fallback);
    throw new Error(`Cannot recover image ${source}: ${error instanceof Error ? error.message : "download failed"}`);
  }
}
const verifiedImages = new Set<string>();
async function verifyImages(snapshot: unknown) {
  const urls = proposalImageUrls(snapshot).filter(url => !verifiedImages.has(url));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      assert.ok(url.startsWith(`${r2Configuration().publicBaseUrl}/report-assets/`) && /\/published-images\/[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$/.test(url), "Image is not preserved");
      const bytes = await fetchExportImage(url);
      assert.equal(digest(bytes.buffer), url.split("/").at(-1)!.split(".")[0], "Public image checksum differs");
      verifiedImages.add(url);
    }
  }));
}
async function main() {
  const mode = process.argv[2] ?? "prepare";
  assert.ok(["prepare", "apply", "verify", "rollback"].includes(mode));
  assert.equal(process.env.STORAGE_PROVIDER, "r2");
  await mkdir(`${root}/rows`, { recursive: true, mode: 0o700 });
  if (mode === "prepare") {
    try { recoveries = await load<Record<string, Recovery>>("recoveries.json"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const plan: { table: Table; id: string; images: number }[] = [], failures: { table: Table; id: string; message: string }[] = [];
    const links = await admin.from("digital_proposal_links").select("id,token,version_id,agency_id,report_id");
    if (links.error) throw links.error;
    await save("links-before.json", links.data);
    for (const table of ["digital_proposal_versions", "prospect_proposals"] as const) {
      for (let offset = 0;; offset += 10) {
        let query = admin.from(table).select("*").order("id").range(offset, offset + 9);
        if (table === "prospect_proposals") query = query.not("published_at", "is", null);
        const result = await query;
        if (result.error) throw result.error;
        for (const original of result.data as Row[]) {
          try {
            // Resuming preparation never overwrites the original backup for a row.
            let prior: Entry | undefined;
            try { prior = await load<Entry>(rowFile(table, original.id)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
            if (prior) assert.deepEqual(prior.original.final_report_json, original.final_report_json, "Snapshot changed since preparation; use a new backup directory");
            if (!prior) {
              await save(`rows/${table}-${original.id}-original.json`, original);
              const replacements = new Map<string, string>();
              const scope = table === "digital_proposal_versions" ? original.agency_id! : `prospects/${original.brand_id}`;
              const snapshot = await preserveProposalImages(original.final_report_json, scope, { timeoutMs: 300_000,
                recover: source => recovery(original, source), onImage: (source, target) => { replacements.set(source, target); },
              });
              prior = { table, original, snapshot, hash: digest(JSON.stringify(snapshot)), replacements: [...replacements] };
              assert.deepEqual(replaceProposalImages(original.final_report_json, replacements), snapshot);
              await save(rowFile(table, original.id), prior);
            }
            plan.push({ table, id: original.id, images: proposalImageUrls(prior.snapshot).length });
            console.log(JSON.stringify({ prepared: plan.length, table, id: original.id, images: proposalImageUrls(prior.snapshot).length }));
          } catch (error) { failures.push({ table, id: original.id, message: error instanceof Error ? error.message : "Image copy failed" }); }
        }
        if (result.data.length < 10) break;
      }
    }
    await save("plan.json", { preparedAt: new Date().toISOString(), plan, failures });
    console.log(JSON.stringify({ prepared: plan.length, failures }));
    if (failures.length) process.exitCode = 1;
    return;
  }
  const plan = await load<{ plan: { table: Table; id: string }[]; failures: unknown[] }>("plan.json");
  assert.equal(plan.failures.length, 0, "Resolve preparation failures before changing any snapshots");
  const hashes = new Set<string>();
  for (const item of plan.plan) {
    const entry = await load<Entry>(rowFile(item.table, item.id));
    if (item.table !== "digital_proposal_versions") continue;
    const key = `${entry.original.report_id}:${entry.hash}`;
    assert.ok(!hashes.has(key), "Two existing versions would acquire the same content hash; review before applying");
    hashes.add(key);
  }
  let processed = 0;
  for (const item of plan.plan) {
    const entry = await load<Entry>(rowFile(item.table, item.id));
    const result = await admin.from(item.table).select("*").eq("id", item.id).single();
    if (result.error) throw result.error;
    const current = result.data as Row;
    for (const key of ["id", "agency_id", "report_id", "share_token", "public_token", "public_slug", "published_at", "created_at", "pdf_path", "revoked_at"]) {
      assert.deepEqual(current[key], entry.original[key], `Publication metadata changed: ${key}`);
    }
    if (mode === "verify") {
      assert.deepEqual(current.final_report_json, entry.snapshot);
      await verifyImages(current.final_report_json);
    } else {
      const rollback = mode === "rollback";
      const before = rollback ? entry.snapshot : entry.original.final_report_json;
      const after = rollback ? entry.original.final_report_json : entry.snapshot;
      if (!isDeepStrictEqual(current.final_report_json, after)) {
        assert.deepEqual(current.final_report_json, before, "Concurrent snapshot change; refusing to overwrite");
        if (!rollback) await verifyImages(after);
        const patch = item.table === "digital_proposal_versions" ? { final_report_json: after, content_hash: rollback ? entry.original.content_hash : entry.hash } : { final_report_json: after };
        let update = admin.from(item.table).update(patch).eq("id", item.id);
        // Compare-and-swap. Prospect snapshots have no hash column, so compare the
        // original JSON directly; its encoded request size is checked during audit.
        update = item.table === "digital_proposal_versions" ? update.eq("content_hash", rollback ? entry.hash : entry.original.content_hash!) : update.eq("final_report_json", JSON.stringify(before));
        const saved = await update.select("id");
        if (saved.error) throw saved.error;
        assert.equal(saved.data.length, 1, "Snapshot changed during update");
      }
    }
    processed++;
    console.log(JSON.stringify({ mode, processed, id: item.id }));
  }
  const oldLinks = await load<Record<string, unknown>[]>("links-before.json");
  const links = await admin.from("digital_proposal_links").select("id,token,version_id,agency_id,report_id");
  if (links.error) throw links.error;
  for (const link of oldLinks) assert.deepEqual(links.data.find(item => item.id === link.id), link, "Existing share link changed");
  await save(`${mode}-result.json`, { completedAt: new Date().toISOString(), processed, unchangedShareLinks: oldLinks.length });
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Proposal image maintenance failed"); process.exitCode = 1; });
