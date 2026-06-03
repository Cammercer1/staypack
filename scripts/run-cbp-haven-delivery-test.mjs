/**
 * Caroline Brown Property → Havenly STR + lease appraisal test.
 *
 * Discovers first listing on /for-sale, runs delivery extract, generates both PDFs.
 *
 * Usage:
 *   npm run dev   # required for PDF print routes
 *   PRINT_BASE_URL=http://localhost:3000 npx tsx scripts/run-cbp-haven-delivery-test.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TENANT_SLUG = "havenly-cbp-test";
const PARTNER_URL = "https://www.carolinebrownproperty.com.au/for-sale";
/** Override first discovered listing (e.g. Harwood regression). */
const LISTING_URL_OVERRIDE = process.env.DELIVERY_TEST_LISTING_URL?.trim();

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
  process.env.NEXT_PUBLIC_REPORTS_URL = process.env.PRINT_BASE_URL.trim();
}

const printBase = (
  process.env.PRINT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_REPORTS_URL?.trim() ||
  "http://localhost:3000"
).replace(/\/$/, "");

async function assertDevServer() {
  const health = await fetch(`${printBase}/`, { redirect: "follow" }).catch(() => null);
  if (!health?.ok) {
    console.error(`Dev server not reachable at ${printBase}. Run: npm run dev`);
    process.exit(1);
  }
}

const { discoverFromPartnerSource } = await import(
  "../lib/delivery/scrape/adapters/index.ts"
);
const { upsertDeliveryTenant } = await import(
  "../lib/delivery/tenants/repository.ts"
);
const { extractListingForDelivery } = await import(
  "../lib/scraping/extractListingForDelivery.ts"
);
const { generateHeadlessStrReport } = await import(
  "../lib/delivery/str/generateHeadlessStr.ts"
);
const { generateHeadlessLeaseAppraisal } = await import(
  "../lib/delivery/lease/generateHeadlessLeaseAppraisal.ts"
);

console.log("Caroline Brown → Havenly STR + lease test\n");
console.log("Partner index:", PARTNER_URL);
console.log("Print base:", printBase);
await assertDevServer();

console.log("\n1. Discovering listings (generic_links)...");
const discovered = await discoverFromPartnerSource({
  url: PARTNER_URL,
  label: "Caroline Brown for sale",
  adapter: "generic_links",
});

if (!discovered.length) {
  console.error("No listings discovered — abort");
  process.exit(1);
}

const listingCandidates = discovered.filter((item) =>
  /\/listing\/[^/]+/i.test(item.listingUrl),
);
const target =
  (LISTING_URL_OVERRIDE
    ? discovered.find((item) => item.listingUrl === LISTING_URL_OVERRIDE)
    : null) ??
  listingCandidates[0] ??
  discovered[0];

if (LISTING_URL_OVERRIDE && target.listingUrl !== LISTING_URL_OVERRIDE) {
  console.error("DELIVERY_TEST_LISTING_URL not found in discovery:", LISTING_URL_OVERRIDE);
  process.exit(1);
}
console.log("   Found", discovered.length);
console.log("   First listing:", target.listingUrl);

console.log("\n2. Delivery extract (agency → REA → Domain)...");
const extracted = await extractListingForDelivery(target.listingUrl);
if (!extracted.ok) {
  console.error("Extract failed:", extracted.reason);
  console.error("Warnings:", extracted.warnings);
  process.exit(1);
}

const parsed = extracted.listing;
console.log("   Address:", parsed.address);
console.log("   Beds/baths:", parsed.bedrooms, parsed.bathrooms);
console.log("   Images:", parsed.images.length);
console.log("   Source:", extracted.source, extracted.parserName);
console.log("   Description:", (parsed.description ?? "").slice(0, 120) + "...");

const tenant = await upsertDeliveryTenant({
  slug: TENANT_SLUG,
  name: "havenly property (CBP test)",
  timezone: "Australia/Brisbane",
  enabled: true,
  scrape_enabled: false,
  scrape_schedule: { type: "interval", intervalHours: 24 },
  partner_sources: [
    {
      label: "Caroline Brown for sale",
      url: PARTNER_URL,
      adapter: "generic_links",
    },
  ],
  email_recipients: ["delivery-test@localhost"],
  str_template_pack_id: "haven_properties",
  deliverables: ["str", "lease_appraisal"],
  billing_mode: "shadow",
  brand: { displayName: "havenly property" },
  feature_flags: {
    rent_appraisal: { tier: "auto" },
  },
  reprocess_on_material_change: false,
});

console.log("\n3. Generating STR report (Airbtics + PDF)...");
console.log("   May take 2–4 minutes...\n");
const str = await generateHeadlessStrReport({
  tenant,
  listingUrl: target.listingUrl,
  parsed,
});

mkdirSync(resolve(ROOT, "tmp"), { recursive: true });
const strOut = resolve(ROOT, `tmp/${str.pdfFilename}`);
writeFileSync(strOut, str.pdfBuffer);
console.log("   STR report id:", str.reportId);
console.log("   Saved:", strOut);

console.log("\n4. Generating lease appraisal (REA rent discover + PDF)...");
console.log("   May take 2–4 minutes...\n");
const lease = await generateHeadlessLeaseAppraisal({
  tenant,
  listingUrl: target.listingUrl,
  parsed,
});

const leaseOut = resolve(ROOT, `tmp/${lease.pdfFilename}`);
writeFileSync(leaseOut, lease.pdfBuffer);
console.log("   Lease report id:", lease.reportId);
console.log("   Saved:", leaseOut);

console.log("\nDone.");
console.log("Listing URL:", target.listingUrl);
console.log("Address:", str.address);
console.log("STR PDF:", strOut);
console.log("Lease PDF:", leaseOut);
