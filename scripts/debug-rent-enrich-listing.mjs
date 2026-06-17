/**
 * Re-run rental enrichment for one listing URL (debug H1 rent band).
 * Usage: npx tsx scripts/debug-rent-enrich-listing.mjs "https://..."
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scripts/debug-rent-enrich-listing.mjs <listingUrl>");
  process.exit(1);
}

if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim().replace(/^[\"']|[\"']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { extractListingForDelivery } = await import(
  "../lib/scraping/extractListingForDelivery.ts"
);
const { enrichListingRentalAppraisal } = await import(
  "../lib/rental/enrichListingRentalAppraisal.ts"
);
const { buildReaRentSearchUrl } = await import("../lib/rental/buildReaRentSearchUrl.ts");

console.log("Extracting…", url);
const extracted = await extractListingForDelivery(url);
if (!extracted.ok) {
  console.error("Extract failed:", extracted.reason);
  process.exit(1);
}

const p = extracted.listing;
console.log("Parsed:", p.address, p.suburb, p.bedrooms, "bed", p.propertyType);
if (p.suburb && p.state && p.postcode && p.bedrooms) {
  console.log(
    "REA rent URL:",
    buildReaRentSearchUrl({
      suburb: p.suburb,
      state: p.state,
      postcode: p.postcode,
      bedrooms: p.bedrooms,
      propertyType: p.propertyType,
      bathrooms: p.bathrooms ?? undefined,
    }),
  );
}

console.log("\nEnriching rental appraisal…");
const enriched = await enrichListingRentalAppraisal(p);
console.log("rentalAppraisal:", enriched.rentalAppraisal);
console.log("comps:", enriched.rentalComps?.length ?? 0);
console.log(
  "warnings:",
  (enriched.warnings ?? []).filter((w) => /rent|Rental/i.test(w)),
);
