/**
 * Test Apify-backed rental enrichment with a known subject listing.
 * Usage: npx tsx scripts/debug-apify-rent-enrich.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim().replace(/^[\"']|[\"']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { getApifyReaMaxListings } = await import("../lib/apify/client.ts");
const { enrichListingRentalAppraisal } = await import(
  "../lib/rental/enrichListingRentalAppraisal.ts"
);

const listing = {
  address: "8/5 Bonney Avenue, Clayfield",
  suburb: "Clayfield",
  state: "QLD",
  postcode: "4011",
  bedrooms: 5,
  bathrooms: 2,
  propertyType: "House",
  purpose: "lease",
  warnings: [],
};

console.log("Apify maxItems:", getApifyReaMaxListings());
console.log("Subject:", listing.address, listing.bedrooms, "bed\n");

const enriched = await enrichListingRentalAppraisal(listing);
console.log("rentalAppraisal:", enriched.rentalAppraisal);
console.log("comps:", enriched.rentalComps?.length ?? 0);
console.log(
  "rent warnings:",
  (enriched.warnings ?? []).filter((w) => /rent|Rental|Apify/i.test(w)),
);
