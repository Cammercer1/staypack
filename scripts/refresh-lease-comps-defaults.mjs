/**
 * Re-fetch rental comps and print default featured selection.
 * Usage: npx tsx scripts/refresh-lease-comps-defaults.mjs <listingId>
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listingId = process.argv[2];
if (!listingId) {
  console.error("Usage: npx tsx scripts/refresh-lease-comps-defaults.mjs <listingId>");
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

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { enrichListingForLeaseAppraisal } = await import(
  "../lib/lease-appraisal/generateLeaseAppraisalForListing.ts"
);
const { defaultSelectedCompListingIds } = await import(
  "../lib/lease-appraisal/leaseAppraisalData.ts"
);
const { rentalCompListingId } = await import("../lib/lease-appraisal/rentalCompIds.ts");
const { rentalCompSubjectScore } = await import("../lib/rental/rankRentalCompsForSubject.ts");

const admin = createAdminClient();
const { data: listing, error } = await admin
  .from("listings")
  .select("*")
  .eq("id", listingId)
  .single();

if (error || !listing) {
  console.error("Listing not found:", error?.message ?? listingId);
  process.exit(1);
}

console.log("Refreshing comps for:", listing.property_address, listing.suburb);
console.log("(Apify/REA — may take 1–3 minutes)\n");

const result = await enrichListingForLeaseAppraisal({ supabase: admin, listing });
const parsed = result.parsed;
const pool = parsed.rentalComps ?? [];

const rankInput = {
  suburb: listing.suburb,
  bedrooms: listing.bedrooms ?? undefined,
  bathrooms: listing.bathrooms ?? undefined,
};

const selectedIds = defaultSelectedCompListingIds(parsed);

console.log("=== AFTER REFRESH ===");
console.log("Pool size:", pool.length);
console.log("Rent band:", {
  min: parsed.rentalAppraisal?.weeklyMin,
  max: parsed.rentalAppraisal?.weeklyMax,
  mid: parsed.rentalAppraisal?.weeklyMidpoint,
});
console.log("\n=== DEFAULT SELECTED (4) ===");

for (const sid of selectedIds) {
  const index = pool.findIndex(
    (c, idx) =>
      rentalCompListingId(c, idx) === sid || c.listingUrl?.trim() === sid,
  );
  const comp = index >= 0 ? pool[index] : null;
  if (!comp) {
    console.log("- (not found)", sid.slice(0, 80));
    continue;
  }
  console.log(
    "-",
    comp.address,
    "|",
    comp.suburb,
    "|",
    comp.bedrooms,
    "bed",
    "$" + comp.weeklyRent + "/wk",
    "| score",
    rentalCompSubjectScore(comp, rankInput),
  );
}

console.log("\n=== TOP 8 BY RANK (for context) ===");
const ranked = pool
  .map((c, idx) => ({ c, idx }))
  .sort(
    (a, b) =>
      rentalCompSubjectScore(b.c, rankInput) -
      rentalCompSubjectScore(a.c, rankInput),
  )
  .slice(0, 8);

for (const { c } of ranked) {
  const picked = selectedIds.some(
    (sid) =>
      sid === rentalCompListingId(c, pool.indexOf(c)) ||
      (c.listingUrl && sid === c.listingUrl.trim()),
  );
  console.log((picked ? "★" : " "), rentalCompSubjectScore(c, rankInput), c.suburb, "$" + c.weeklyRent, c.address?.slice(0, 55));
}

const randwickCount = pool.filter(
  (c) => c.suburb?.trim().toLowerCase() === listing.suburb?.trim().toLowerCase(),
).length;
console.log("\nRandwick comps in pool:", randwickCount);
