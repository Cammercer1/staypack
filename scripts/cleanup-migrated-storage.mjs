/**
 * Remove only migrated private files and unreferenced, old rendering mirrors.
 * Default is a read-only plan. --apply additionally requires successful production
 * link checks and a recent inventory. Public report PDFs and ordinary assets are
 * deliberately retained because previously shared Supabase URLs cannot redirect.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const apply = process.argv.includes("--apply"), root = "tmp/r2-migration";
assert.equal(process.env.STORAGE_PROVIDER, "r2");
const source = process.env.NEXT_PUBLIC_SUPABASE_URL;
const inventory = JSON.parse(await readFile(`${root}/inventory.json`, "utf8"));
assert.equal(inventory.source, source);
assert.ok(Date.now() - Date.parse(inventory.asOf) < 30 * 60_000, "Refresh inventory before planning or cleanup");
const records = new Map((await readFile(`${root}/manifest.jsonl`, "utf8")).trim().split("\n").map(line => { const row = JSON.parse(line); return [row.key, row]; }));
const admin = createClient(source, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tables = ["reports", "collateral_items", "listings", "digital_proposal_versions", "digital_proposal_links", "digital_proposal_attachments", "digital_proposal_drafts", "agencies", "agent_profiles", "prospect_brands", "prospect_proposals", "delivery_tenants", "delivery_usage_events"];
const references = new Set();
function visit(value) {
  if (typeof value === "string") {
    let decoded = value; try { decoded = decodeURIComponent(value); } catch { /* Literal non-URL text. */ }
    decoded = decoded.replaceAll("\\/", "/");
    for (const match of decoded.matchAll(/(?:report-assets\/)?[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:pdf-images|pdf-assets)\/[a-zA-Z0-9._-]+/g)) {
      references.add(match[0].startsWith("report-assets/") ? match[0] : `report-assets/${match[0]}`);
    }
  } else if (Array.isArray(value)) value.forEach(visit);
  else if (value && typeof value === "object") Object.values(value).forEach(visit);
}
const tableCounts = {};
for (const table of tables) {
  tableCounts[table] = 0;
  // Report snapshots can be large; small pages avoid the free-tier statement timeout.
  for (let offset = 0;; offset += 25) {
    const { data, error } = await admin.from(table).select("*").range(offset, offset + 24).order(table === "digital_proposal_drafts" ? "report_id" : "id");
    if (error) throw new Error(`Reference scan failed for ${table}: ${error.message}`);
    visit(data); tableCounts[table] += data.length;
    if (data.length < 25) break;
  }
}
const candidates = inventory.objects.filter(o => {
  const key = `${o.bucket}/${o.name}`;
  return ["proposal-pdfs", "proposal-documents"].includes(o.bucket) ||
    (o.bucket === "report-assets" && /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/(pdf-images|pdf-assets)\/[a-f0-9]{16}\.(jpg|png|webp|css)$/.test(o.name) &&
      !references.has(key) && Date.parse(o.updated_at) < Date.now() - 60 * 60_000);
});
for (const object of candidates) {
  const key = `${object.bucket}/${object.name}`, record = records.get(key);
  assert.ok(record, `Missing verified copy for ${key}`);
  assert.equal(record.source, source);
  assert.equal(record.sourceETag, object.metadata.eTag, `Source changed: ${key}`);
  assert.equal(record.sourceUpdatedAt, object.updated_at, `Source changed: ${key}`);
  assert.equal(record.size, object.metadata.size);
  assert.equal(record.r2Bucket, process.env[object.bucket === "report-assets" ? "R2_PUBLIC_BUCKET" : "R2_PRIVATE_BUCKET"]);
}
const plan = { createdAt: new Date().toISOString(), source, inventoryAt: inventory.asOf, tableCounts, referencedRenderingObjects: references.size,
  candidateCount: candidates.length, candidateBytes: candidates.reduce((s, o) => s + o.metadata.size, 0),
  retainedBytes: inventory.objects.filter(o => !candidates.includes(o)).reduce((s, o) => s + o.metadata.size, 0),
  candidates: candidates.map(o => ({ key: `${o.bucket}/${o.name}`, bytes: o.metadata.size })) };
await writeFile(`${root}/cleanup-plan.json`, JSON.stringify(plan, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ ...plan, candidates: undefined }));
if (!apply) process.exit(0);
const verification = JSON.parse(await readFile(`${root}/links-production.json`, "utf8"));
assert.equal(verification.origin, "https://staypack.app");
assert.equal(verification.failures.length, 0);
assert.ok(verification.proposals.length >= 3 && verification.reports.length >= 5 && verification.legacyPublicPdfs >= 183);
assert.ok(Date.now() - Date.parse(verification.checkedAt) < 60 * 60_000, "Production checks are stale");
const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
const normalize = tag => tag?.replace(/^W\//, "").replace(/^"|"$/g, "");
let next = 0, removed = 0, bytes = 0;
const failures = [];
// Validate *all* backups and targets before removing a single source object.
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < candidates.length) {
    const object = candidates[next++], Key = `${object.bucket}/${object.name}`, record = records.get(Key);
    const backup = await readFile(`${root}/backup/${Key}`);
    assert.equal(createHash("sha256").update(backup).digest("hex"), record.sha256, `Backup mismatch: ${Key}`);
    const target = await client.send(new HeadObjectCommand({ Bucket: record.r2Bucket, Key }));
    assert.equal(target.ContentLength, record.size); assert.equal(target.Metadata?.sha256, record.sha256);
    const original = await fetch(`${source}/storage/v1/object/authenticated/${Key.split("/").map(encodeURIComponent).join("/")}`, { method: "HEAD", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(30_000) });
    assert.equal(original.status, 200); assert.equal(normalize(original.headers.get("etag")), normalize(record.sourceETag));
  }
}));
for (const bucket of ["proposal-pdfs", "proposal-documents", "report-assets"]) {
  const objects = candidates.filter(o => o.bucket === bucket);
  for (let offset = 0; offset < objects.length; offset += 100) {
    const batch = objects.slice(offset, offset + 100);
    const { error } = await admin.storage.from(bucket).remove(batch.map(o => o.name));
    if (error) { failures.push({ bucket, offset, message: error.message }); break; }
    for (const object of batch) await appendFile(`${root}/deleted.jsonl`, `${JSON.stringify({ key: `${bucket}/${object.name}`, bytes: object.metadata.size, deletedAt: new Date().toISOString() })}\n`, { mode: 0o600 });
    removed += batch.length; bytes += batch.reduce((sum, o) => sum + o.metadata.size, 0);
    console.log(JSON.stringify({ removed, bytes }));
  }
  if (failures.length) break;
}
const result = { completedAt: new Date().toISOString(), removed, bytes, failures };
await writeFile(`${root}/cleanup-result.json`, JSON.stringify(result, null, 2), { mode: 0o600 });
assert.equal(failures.length, 0, "Cleanup incomplete; inspect evidence before retrying");
