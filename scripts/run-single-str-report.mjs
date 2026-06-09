/**
 * One-off Havenly STR report from a direct REA URL.
 *
 * Usage:
 *   npm run dev
 *   PDF_PRINT_BASE_URL=http://localhost:3000 npx tsx scripts/run-single-str-report.mjs <rea-url>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LISTING_URL = process.argv[2]?.trim();
const TENANT_SLUG = process.env.STR_TENANT_SLUG?.trim() || "havenly-single-str-test";

if (!LISTING_URL) {
  console.error("Usage: npx tsx scripts/run-single-str-report.mjs <rea-url>");
  process.exit(1);
}

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

if (process.env.PRINT_BASE_URL?.trim()) {
  process.env.PDF_PRINT_BASE_URL = process.env.PRINT_BASE_URL.trim();
}

const { extractListingForDelivery } = await import(
  "../lib/scraping/extractListingForDelivery.ts"
);
const { upsertDeliveryTenant } = await import(
  "../lib/delivery/tenants/repository.ts"
);
const { generateHeadlessStrReport } = await import(
  "../lib/delivery/str/generateHeadlessStr.ts"
);
const { getPrintRenderBaseUrl } = await import("../lib/env.ts");

console.log("Havenly STR report for:", LISTING_URL);
console.log("Print base:", getPrintRenderBaseUrl());
console.log();

console.log("1. Scraping listing...");
const extracted = await extractListingForDelivery(LISTING_URL);
if (!extracted.ok) {
  console.error("Extract failed:", extracted.reason);
  console.error("Warnings:", extracted.warnings);
  process.exit(1);
}

const parsed = extracted.listing;
// Off-market / agency rental pages are still valid STR appraisal subjects.
if (/\/rental\//i.test(LISTING_URL)) {
  parsed.purpose = "sale";
}
console.log("   Address:", parsed.address);
console.log("   Beds/baths:", parsed.bedrooms, parsed.bathrooms);
console.log("   Images:", parsed.images.length);
console.log("   Parser:", extracted.parserName);

const tenant = await upsertDeliveryTenant({
  slug: TENANT_SLUG,
  name: "havenly property (single test)",
  timezone: "Australia/Brisbane",
  enabled: true,
  scrape_enabled: false,
  scrape_schedule: { type: "interval", intervalHours: 24 },
  partner_sources: [],
  email_recipients: ["delivery-test@localhost"],
  str_template_pack_id: "haven_properties",
  deliverables: ["str"],
  billing_mode: "shadow",
  brand: { displayName: "havenly property" },
  reprocess_on_material_change: false,
});

console.log("\n2. Generating STR report (Airbtics + copy + PDF)...");
console.log("   May take 2–4 minutes...\n");

const str = await generateHeadlessStrReport({
  tenant,
  listingUrl: LISTING_URL,
  parsed,
});

mkdirSync(resolve(ROOT, "tmp"), { recursive: true });
const out = resolve(ROOT, `tmp/${str.pdfFilename}`);
writeFileSync(out, str.pdfBuffer);

console.log("Done.");
console.log("Report id:", str.reportId);
console.log("Address:", str.address);
console.log("Public URL:", str.publicUrl);
console.log("Saved:", out);
