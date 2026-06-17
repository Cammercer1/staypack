/**
 * Inspect lease appraisal comps + selection for a listing.
 * Usage: npx tsx scripts/debug-lease-comps-listing.mjs <listingId>
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listingId = process.argv[2];
if (!listingId) {
  console.error("Usage: npx tsx scripts/debug-lease-comps-listing.mjs <listingId>");
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

const parsed = listing.scraped_listing_json;
const pool = parsed?.rentalComps ?? [];
const selected = parsed?.rentalAppraisal?.selectedCompListingIds ?? [];
const rankInput = {
  suburb: listing.suburb,
  bedrooms: listing.bedrooms ?? undefined,
  bathrooms: listing.bathrooms ?? undefined,
};

function compId(comp, index) {
  return rentalCompListingId(comp, index);
}

function isSelected(comp, index) {
  const id = compId(comp, index);
  const url = comp.listingUrl?.trim();
  return selected.includes(id) || (url && selected.includes(url));
}

console.log("=== SUBJECT ===");
console.log(
  [listing.property_address, listing.suburb, listing.state, listing.postcode]
    .filter(Boolean)
    .join(", "),
);
console.log(
  "Beds:",
  listing.bedrooms,
  "Baths:",
  listing.bathrooms,
  "Type:",
  parsed?.propertyType,
);

console.log("\n=== RENT BAND (stored) ===");
const ra = parsed?.rentalAppraisal;
console.log({
  weeklyMin: ra?.weeklyMin,
  weeklyMax: ra?.weeklyMax,
  weeklyMidpoint: ra?.weeklyMidpoint,
  compCount: ra?.compCount,
  source: ra?.source,
  premiumTier: ra?.premiumTier,
});

console.log("\n=== SELECTED FOR PAGE 2 (" + selected.length + ") ===");
for (const sid of selected) {
  const index = pool.findIndex(
    (c, idx) => compId(c, idx) === sid || c.listingUrl?.trim() === sid,
  );
  const comp = index >= 0 ? pool[index] : null;
  if (!comp) {
    console.log("- (missing from pool)", sid.slice(0, 90));
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
    "| pool index",
    index,
  );
}

console.log("\n=== FULL POOL (sorted by current rank logic) ===");
const ranked = pool
  .map((c, idx) => ({ c, idx }))
  .sort(
    (a, b) =>
      rentalCompSubjectScore(b.c, rankInput) -
      rentalCompSubjectScore(a.c, rankInput),
  );

for (const { c, idx } of ranked) {
  const star = isSelected(c, idx) ? "★" : " ";
  console.log(
    star,
    String(rentalCompSubjectScore(c, rankInput)).padStart(3),
    (c.suburb ?? "?").padEnd(16),
    String(c.bedrooms ?? "?").padStart(2) + "bd",
    ("$" + c.weeklyRent).padStart(6),
    (c.address ?? "").slice(0, 58),
  );
}

const subjectSuburb = listing.suburb?.trim().toLowerCase();
const inSuburb = pool.filter(
  (c) => c.suburb?.trim().toLowerCase() === subjectSuburb,
);
console.log("\n=== Same-suburb comps in pool:", inSuburb.length, "===");
for (const c of inSuburb) {
  console.log(" ", c.address, "$" + c.weeklyRent + "/wk", "score", rentalCompSubjectScore(c, rankInput));
}

const warnings = (parsed?.warnings ?? []).filter((w) =>
  /rent|Rental|REA|appraisal/i.test(w),
);
if (warnings.length) {
  console.log("\n=== Rental warnings ===");
  for (const w of warnings) console.log("-", w);
}
