/**
 * Re-run LLM lease appraisal positioning for a listing (no REA re-scrape).
 * Usage: npx tsx scripts/rerun-lease-positioning.mjs <listingId>
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listingId = process.argv[2];
if (!listingId) {
  console.error("Usage: npx tsx scripts/rerun-lease-positioning.mjs <listingId>");
  process.exit(1);
}

if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { ensureLeaseAppraisalPositioning } = await import(
  "../lib/lease-appraisal/positionLeaseAppraisal.ts"
);
const { formatWeeklyRentRange } = await import("../lib/rental/computeRentBand.ts");

const admin = createAdminClient();
const { data: listing, error } = await admin
  .from("listings")
  .select("*")
  .eq("id", listingId)
  .single();

if (error || !listing?.scraped_listing_json) {
  console.error("Listing not found or missing scraped data:", error?.message ?? listingId);
  process.exit(1);
}

const before = listing.scraped_listing_json.rentalAppraisal;
console.log("Before:", before?.weeklyMin, "-", before?.weeklyMax, `(mid ${before?.weeklyMidpoint})`);

const positioned = await ensureLeaseAppraisalPositioning(listing.scraped_listing_json);
const after = positioned.rentalAppraisal;

if (!after?.positioning) {
  console.log("No positioning applied (missing OPENAI_API_KEY or comps).");
  process.exit(0);
}

console.log("After:", after.weeklyMin, "-", after.weeklyMax, `(mid ${after.weeklyMidpoint})`);
console.log("Range:", formatWeeklyRentRange(after.weeklyMin, after.weeklyMax));
console.log("Confidence:", after.positioning.confidence);
console.log("Rationale:", after.positioning.rationale);
if (after.positioning.was_clamped) {
  console.log("(LLM band was clamped to comp anchors)");
}

const { error: saveError } = await admin
  .from("listings")
  .update({ scraped_listing_json: positioned })
  .eq("id", listingId);

if (saveError) {
  console.error("Failed to save:", saveError.message);
  process.exit(1);
}

console.log("Saved to listing", listingId);
