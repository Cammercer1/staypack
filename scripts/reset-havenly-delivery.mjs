/**
 * Wipe Havenly managed-delivery history so the next run re-scrapes fresh
 * (max 1 listing per partner site from havenly.json).
 *
 * Deletes: delivery ledger, scrape runs, usage events, md-havenly listings/reports,
 * and report PDFs in storage. Keeps the delivery_tenants row and shadow agency.
 *
 * Usage: npx tsx scripts/reset-havenly-delivery.mjs
 *        npx tsx scripts/reset-havenly-delivery.mjs --dry-run
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TENANT_SLUG = "havenly";
const dryRun = process.argv.includes("--dry-run");

function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { shadowAgencySlug } = await import(
  "../lib/delivery/brand/ensureShadowAgency.ts"
);

const admin = createAdminClient();

const { data: tenant, error: tenantErr } = await admin
  .from("delivery_tenants")
  .select("id, slug, agency_id")
  .eq("slug", TENANT_SLUG)
  .maybeSingle();

if (tenantErr || !tenant) {
  console.error("Tenant not found:", tenantErr?.message ?? TENANT_SLUG);
  process.exit(1);
}

const agencySlug = shadowAgencySlug(TENANT_SLUG);
const agencyId = tenant.agency_id;

const { data: agency } = agencyId
  ? { data: { id: agencyId } }
  : await admin.from("agencies").select("id").eq("slug", agencySlug).maybeSingle();

const { data: properties } = await admin
  .from("delivery_tenant_properties")
  .select("id, listing_url, listing_id, delivery_reports, status")
  .eq("tenant_id", tenant.id);

const { count: runCount } = await admin
  .from("delivery_scrape_runs")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenant.id);

const { count: eventCount } = await admin
  .from("delivery_usage_events")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenant.id);

let listingIds = [];
let reportIds = new Set();

if (agency?.id) {
  const { data: listings } = await admin
    .from("listings")
    .select("id")
    .eq("agency_id", agency.id);
  listingIds = (listings ?? []).map((l) => l.id);

  if (listingIds.length) {
    const { data: reports } = await admin
      .from("reports")
      .select("id")
      .in("listing_id", listingIds);
    for (const r of reports ?? []) {
      reportIds.add(r.id);
    }
  }
}

for (const row of properties ?? []) {
  if (row.listing_id) listingIds.push(row.listing_id);
  const dr = row.delivery_reports;
  if (dr?.str?.reportId) reportIds.add(dr.str.reportId);
  if (dr?.lease?.reportId) reportIds.add(dr.lease.reportId);
}

listingIds = [...new Set(listingIds)];
reportIds = [...new Set(reportIds)];

const storagePaths = [];
if (agency?.id) {
  for (const reportId of reportIds) {
    storagePaths.push(`${agency.id}/${reportId}/delivery-report.pdf`);
    storagePaths.push(`${agency.id}/${reportId}/lease-appraisal.pdf`);
  }
}

console.log(dryRun ? "DRY RUN — nothing will be deleted\n" : "Resetting Havenly delivery…\n");
console.log("Tenant:", tenant.id, TENANT_SLUG);
console.log("Shadow agency:", agency?.id ?? "(none)", agencySlug);
console.log("Ledger rows:", properties?.length ?? 0);
console.log("Scrape runs:", runCount ?? 0);
console.log("Usage events:", eventCount ?? 0);
console.log("Listings:", listingIds.length);
console.log("Reports:", reportIds.length);
console.log("Storage PDF paths:", storagePaths.length);
for (const url of (properties ?? []).map((p) => p.listing_url).filter(Boolean)) {
  console.log(" -", url);
}

if (dryRun) {
  process.exit(0);
}

await admin.from("delivery_usage_events").delete().eq("tenant_id", tenant.id);
await admin.from("delivery_tenant_properties").delete().eq("tenant_id", tenant.id);
await admin.from("delivery_scrape_runs").delete().eq("tenant_id", tenant.id);
await admin
  .from("delivery_tenants")
  .update({ last_scrape_at: null })
  .eq("id", tenant.id);

if (storagePaths.length) {
  const { error: storageErr } = await admin.storage
    .from("report-pdfs")
    .remove(storagePaths);
  if (storageErr) {
    console.warn("Storage remove (some paths may be missing):", storageErr.message);
  }
}

if (listingIds.length) {
  const { error: listErr } = await admin
    .from("listings")
    .delete()
    .in("id", listingIds);
  if (listErr) throw new Error(listErr.message);
}

console.log("\nDone. Run: npx tsx scripts/provision-and-run-havenly.mjs");
