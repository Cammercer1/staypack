/**
 * Test rent enrichment for Labrador unit (type + luxury keywords).
 * Usage: npx tsx scripts/debug-labrador-rent-enrich.mjs
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
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const { buildRentDiscoverAttempts } = await import(
  "../lib/rental/buildRentDiscoverAttempts.ts"
);
const { parseListingPremiumSignals } = await import(
  "../lib/rental/parseListingPremiumSignals.ts"
);
const { resolveRentSubjectPropertyType } = await import(
  "../lib/rental/resolveRentSubjectPropertyType.ts"
);
const { enrichListingRentalAppraisal } = await import(
  "../lib/rental/enrichListingRentalAppraisal.ts"
);
const { matchesSubjectPropertyType, propertyTypeFamily } = await import(
  "../lib/rental/computeRentBand.ts"
);

const listing = {
  address: "5/326-342 Marine Parade, Labrador",
  suburb: "Labrador",
  state: "QLD",
  postcode: "4215",
  bedrooms: 3,
  bathrooms: 2,
  propertyType: "Villa",
  description:
    "Luxury waterfront apartment with resort-style amenities, pool, gym, air conditioning, and stunning water views.",
  purpose: "lease",
  warnings: [],
};

console.log("Resolved type:", resolveRentSubjectPropertyType(listing));
console.log("Type family:", propertyTypeFamily(resolveRentSubjectPropertyType(listing)));

const signals = parseListingPremiumSignals(listing);
const attempts = buildRentDiscoverAttempts(listing, signals);
console.log("\nSearch attempts:");
for (const a of attempts) {
  console.log(` - ${a.label}: ${a.searchUrl.slice(0, 110)}…`);
}

console.log("\nEnriching…");
const enriched = await enrichListingRentalAppraisal(listing);
console.log("\nsearchUrl:", enriched.rentalAppraisal?.searchUrl);
console.log("band:", enriched.rentalAppraisal?.weeklyMin, "-", enriched.rentalAppraisal?.weeklyMax);
console.log("premium:", enriched.rentalAppraisal?.premiumTier);
console.log("featured comps:", enriched.rentalComps?.length);
for (const c of enriched.rentalComps ?? []) {
  console.log(
    `  ${c.address} | ${c.propertyType} | $${c.weeklyRent}/wk | ${c.suburb}`,
  );
}
console.log(
  "\nrent warnings:",
  (enriched.warnings ?? []).filter((w) => /rent|Rental|luxury|keyword/i.test(w)),
);

const subjectType = resolveRentSubjectPropertyType(listing);
const wrongType = (enriched.rentalComps ?? []).filter(
  (c) => !matchesSubjectPropertyType(c, subjectType),
);
console.log("\nWrong-type featured comps:", wrongType.length);
