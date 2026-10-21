/**
 * Run with Node 24 and --env-file=.env.local --env-file=.env.r2-migration.local.
 * inventory: read-only inventory. copy: backup, copy, full SHA-256 readback.
 * restore: restore deleted originals from verified local backups, without overwrite.
 * No source deletion is performed by this script. Private originals and rendering
 * caches may be removed only after deployment/access verification and fresh checks.
 */
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const [mode = "inventory", outputArg = "tmp/r2-migration"] = process.argv.slice(2);
if (!["inventory", "copy", "verify", "restore"].includes(mode)) throw new Error("Use inventory, copy, verify, or restore");
const output = resolve(outputArg);
await mkdir(output, { recursive: true, mode: 0o700 });
const source = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error("Missing Supabase service role key");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const publicBuckets = new Set(["agency-assets", "agent-assets", "report-assets", "report-pdfs"]);
const privateBuckets = new Set(["proposal-pdfs", "proposal-documents", "scrape-html"]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const normalizeETag = value => value?.replace(/^W\//, "").replace(/^"|"$/g, "");
const objectKey = o => `${o.bucket}/${o.name}`;

async function sourceRequest(path, body) {
  const response = await fetch(new URL(path, source), { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Supabase read failed (${response.status})`);
  return response;
}

if (mode === "restore") {
  const records = new Map((await readFile(`${output}/manifest.jsonl`, "utf8")).trim().split("\n").map(line => { const row = JSON.parse(line); return [row.key, row]; }));
  const deleted = [...new Set((await readFile(`${output}/deleted.jsonl`, "utf8")).trim().split("\n").map(line => JSON.parse(line).key))];
  let restored = 0;
  for (const Key of deleted) {
    const record = records.get(Key);
    if (!record || record.source !== source.origin || ![...publicBuckets, ...privateBuckets].includes(record.bucket) || objectKey({ bucket: record.bucket, name: record.path }) !== Key) throw new Error("Invalid restore manifest");
    const backup = await readFile(resolve(output, "backup", Key));
    if (hash(backup) !== record.sha256) throw new Error("Backup checksum mismatch");
    const encoded = Key.split("/").map(encodeURIComponent).join("/");
    const existing = await fetch(new URL(`/storage/v1/object/authenticated/${encoded}`, source), { headers });
    if (existing.ok) {
      if (hash(Buffer.from(await existing.arrayBuffer())) !== record.sha256) throw new Error("Current source differs; refusing to overwrite");
      continue;
    }
    // Supabase reports a missing object as 400 with statusCode 404 in the body.
    const missing = await existing.json();
    if (existing.status !== 404 && String(missing.statusCode) !== "404") throw new Error("Could not check original object");
    const upload = await fetch(new URL(`/storage/v1/object/${encoded}`, source), { method: "POST", headers: { ...headers, "Content-Type": record.contentType, "x-upsert": "false" }, body: backup });
    if (!upload.ok) throw new Error(`Restore failed (${upload.status})`);
    if (hash(Buffer.from(await (await sourceRequest(`/storage/v1/object/authenticated/${encoded}`)).arrayBuffer())) !== record.sha256) throw new Error("Restored checksum differs");
    restored++;
  }
  console.log(JSON.stringify({ restored, alreadyPresent: deleted.length - restored }));
} else if (mode === "inventory") {
  const buckets = await (await sourceRequest("/storage/v1/bucket")).json();
  const queue = buckets.map(b => ({ bucket: b.id, prefix: "" }));
  const objects = [];
  let calls = 0;
  async function scan({ bucket, prefix }) {
    for (let offset = 0;; offset += 1000) {
      const rows = await (await sourceRequest(`/storage/v1/object/list/${bucket}`, { prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } })).json();
      calls++;
      for (const row of rows) {
        const name = prefix ? `${prefix}/${row.name}` : row.name;
        if (row.id === null) queue.push({ bucket, prefix: name });
        else objects.push({ ...row, bucket, name });
      }
      if (rows.length < 1000) break;
    }
  }
  while (queue.length) {
    await Promise.all(queue.splice(0, 6).map(scan));
    if (calls % 240 < 6) console.log(JSON.stringify({ calls, objects: objects.length, foldersRemaining: queue.length }));
  }
  if (new Set(objects.map(objectKey)).size !== objects.length) throw new Error("Duplicate inventory keys");
  const data = { source: source.origin, asOf: new Date().toISOString(), buckets, objects };
  await writeFile(`${output}/inventory.json`, JSON.stringify(data, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ inventory: `${output}/inventory.json`, objects: objects.length, bytes: objects.reduce((sum, o) => sum + Number(o.metadata?.size || 0), 0) }));
} else {
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET"]) {
    if (!process.env[name]) throw new Error(`Missing ${name}`);
  }
  if (process.env.R2_PUBLIC_BUCKET === process.env.R2_PRIVATE_BUCKET) throw new Error("Public/private buckets must differ");
  const r2 = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
  const inventory = JSON.parse(await readFile(`${output}/inventory.json`, "utf8"));
  if (inventory.source !== source.origin) throw new Error("Inventory belongs to another source project");
  const previous = new Map();
  try { for (const line of (await readFile(`${output}/manifest.jsonl`, "utf8")).trim().split("\n").filter(Boolean)) { const record = JSON.parse(line); previous.set(record.key, record); } } catch (error) { if (error.code !== "ENOENT") throw error; }
  let next = 0, verified = 0, bytes = 0;
  const failures = [];
  async function migrate(o) {
    if (!publicBuckets.has(o.bucket) && !privateBuckets.has(o.bucket)) throw new Error("Unknown bucket; classify its visibility first");
    if (o.name.startsWith("/") || /[\\\x00-\x1f]/.test(o.name) || o.name.split("/").some(p => !p || p === "." || p === "..")) throw new Error("Unsafe object path");
    const Key = objectKey(o);
    const Bucket = process.env[publicBuckets.has(o.bucket) ? "R2_PUBLIC_BUCKET" : "R2_PRIVATE_BUCKET"];
    const prior = previous.get(Key);
    const backupPath = resolve(output, "backup", Key);
    if (prior && prior.sourceUpdatedAt === o.updated_at && prior.sourceETag === o.metadata?.eTag && prior.size === o.metadata?.size && prior.r2Bucket === Bucket && prior.source === source.origin) {
      const backup = await readFile(backupPath);
      if (hash(backup) !== prior.sha256) throw new Error("Backup checksum mismatch");
      const head = await r2.send(new HeadObjectCommand({ Bucket, Key }));
      if (head.ContentLength === prior.size && head.Metadata?.sha256 === prior.sha256) {
        if (mode === "verify") {
          const target = await r2.send(new GetObjectCommand({ Bucket, Key }));
          if (hash(await target.Body.transformToByteArray()) !== prior.sha256) throw new Error("Target checksum mismatch");
        }
        verified++; bytes += prior.size; return;
      }
      throw new Error("Previously migrated target changed; investigate before overwriting");
    }
    if (mode === "verify") throw new Error("Object has no matching copy manifest");
    const encoded = Key.split("/").map(encodeURIComponent).join("/");
    const response = await sourceRequest(`/storage/v1/object/authenticated/${encoded}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length !== Number(o.metadata?.size)) throw new Error("Source size changed; refresh inventory");
    // Supabase's CDN prefixes compressed text responses with W/; fetch decompresses
    // the body, so compare the underlying object tag and original byte length.
    const etag = normalizeETag(response.headers.get("etag"));
    if (etag && o.metadata?.eTag && etag !== normalizeETag(o.metadata.eTag)) throw new Error("Source ETag changed; refresh inventory");
    const sha256 = hash(body);
    const contentType = response.headers.get("content-type") || o.metadata?.mimetype || "application/octet-stream";
    await mkdir(dirname(backupPath), { recursive: true, mode: 0o700 });
    await writeFile(backupPath, body, { mode: 0o600 });
    // Never replace an existing target without checking its bytes first.
    let existing;
    try { existing = await r2.send(new GetObjectCommand({ Bucket, Key })); }
    catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
    if (existing) {
      if (hash(await existing.Body.transformToByteArray()) !== sha256) throw new Error("Target already exists with different bytes");
    } else {
      await r2.send(new PutObjectCommand({ Bucket, Key, Body: body, ContentType: contentType, CacheControl: response.headers.get("cache-control") || "max-age=3600", Metadata: { sha256, source: "supabase", "source-bucket": o.bucket }, IfNoneMatch: "*" }));
    }
    const target = await r2.send(new GetObjectCommand({ Bucket, Key }));
    if (hash(await target.Body.transformToByteArray()) !== sha256) throw new Error("Target checksum mismatch");
    const record = { source: source.origin, key: Key, bucket: o.bucket, path: o.name, r2Bucket: Bucket, size: body.length, sha256, contentType, sourceETag: o.metadata?.eTag, sourceUpdatedAt: o.updated_at, verifiedAt: new Date().toISOString() };
    await appendFile(`${output}/manifest.jsonl`, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    verified++; bytes += body.length;
  }
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < inventory.objects.length) {
      const o = inventory.objects[next++];
      try { await migrate(o); } catch (error) { failures.push({ key: objectKey(o), reason: error.name, message: error.message }); }
      if ((verified + failures.length) % 100 === 0) console.log(JSON.stringify({ verified, failed: failures.length, MB: Math.round(bytes / 1e6) }));
    }
  }));
  const result = { mode, completedAt: new Date().toISOString(), source: source.origin, verified, bytes, failures };
  await writeFile(`${output}/${mode}-result.json`, JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ...result, failures: failures.slice(0, 10) }));
  if (failures.length) process.exitCode = 1;
}
