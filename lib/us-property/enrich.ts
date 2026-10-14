import { fetchUsPropertyData } from "./client";
import { matchesUsAddress, normaliseUsProperty } from "./normalise";
import { discoverUsComparables, hasMatchingUsProfile } from "./comparables";
import { monthlyToWeekly } from "@/lib/property-market";
import type { ParsedListing } from "@/lib/types";
export { normaliseUsComparables } from "./comparables";
/** Exact subject estimates and qualified evidence only. No invented AVM confidence. */
export async function enrichUsAppraisal(subject: ParsedListing, kind: "lease" | "sales"): Promise<ParsedListing> {
  let listing = { ...subject, domainAvm: undefined, ltrSuburbMarket: undefined };
  const warnings = [...subject.warnings];
  try {
    const age = Date.now() - Date.parse(subject.usProperty?.observedAt ?? "");
    if (!hasMatchingUsProfile(subject) || !(age >= 0 && age < 86400000)) {
      const result = normaliseUsProperty(await fetchUsPropertyData("property-details-address", { address: [subject.address, subject.suburb, subject.state, subject.postcode].filter(Boolean).join(", ") }));
      if (!matchesUsAddress(subject, result.parsed)) throw new Error("The property profile did not match the subject address.");
      listing = { ...listing, usProperty: result.parsed.usProperty };
    }
  } catch {
    warnings.push("Current US property estimates were unavailable. Review comparable evidence or enter your own appraisal.");
  }
  const { comps, search } = await discoverUsComparables(listing, kind);
  if (search.stopReason === "request_failed" || search.stopReason === "time_limit") warnings.push(comps.length
    ? "The US comparable search stopped early. Available matches have been kept for review."
    : "US comparable listings are unavailable. The property estimate can still be reviewed or replaced manually.");
  if (!search.targetMet) warnings.push(`Found ${comps.length} relevant US comparables; the target is 20–30. More distant or dissimilar homes have not been added to fill the list.`);
  if (search.requestCount && search.radiusMiles == null) warnings.push("Verified property coordinates were unavailable. Comparable searches were limited to the same ZIP code.");
  if (search.radiusMiles != null && search.radiusMiles > 1) warnings.push(`The comparable search expanded to a ${search.radiusMiles}-mile radius. Review each property's location and condition.`);
  if (comps.length < 3) warnings.push("Fewer than three matching US comparables were found. Review the estimate with local evidence.");
  const midBand = kind === "lease" ? listing.usProperty?.rentMonthly : listing.usProperty?.valuation;
  // A local sample is evidence, not an automatic substitute for a missing valuation.
  if (!midBand) warnings.push(`No current ${kind === "lease" ? "rent" : "value"} estimate is available. Enter your own appraisal; asking and historic sale prices have not been substituted.`);
  if (kind === "lease") {
    listing.rentalAppraisal = { source: "zillow", weeklyMin: midBand?.low == null ? undefined : monthlyToWeekly(midBand.low), weeklyMax: midBand?.high == null ? undefined : monthlyToWeekly(midBand.high), weeklyMidpoint: midBand ? monthlyToWeekly(midBand.mid) : undefined, compCount: comps.length, usSearch: search };
    listing.rentalComps = comps.map((c) => ({ address: c.streetAddress, suburb: c.city, weeklyRent: monthlyToWeekly(c.price), bedrooms: c.bedrooms, bathrooms: c.bathrooms ?? undefined, floorAreaSqm: c.livingArea ? c.livingArea * 0.09290304 : undefined, propertyType: subject.propertyType, listingUrl: c.detailUrl, imageUrl: c.imgSrc ?? undefined, provider: "zillow", usMatch: c.match }));
  } else {
    listing.salesAppraisal = { source: "zillow", priceMin: midBand?.low, priceMax: midBand?.high, priceMidpoint: midBand?.mid, compCount: comps.length, soldCompCount: comps.length, forSaleCompCount: 0, usSearch: search };
    listing.salesComps = comps.map((c) => ({ address: c.streetAddress, suburb: c.city, price: c.price, saleStatus: "sold", soldDate: new Date(c.dateSold!).toISOString().slice(0,10), bedrooms: c.bedrooms, bathrooms: c.bathrooms ?? undefined, floorAreaSqm: c.livingArea ? c.livingArea * 0.09290304 : undefined, propertyType: subject.propertyType, listingUrl: c.detailUrl, imageUrl: c.imgSrc ?? undefined, usMatch: c.match }));
  }
  return { ...listing, warnings: [...new Set(warnings)] };
}
