import { marketForCountry } from "@/lib/property-market";
import type { Listing, ParsedListing } from "@/lib/types";

/** Preparation-time copy only. Published proposal snapshots retain their saved wording. */
export function appraisalGuideCopy(kind: "lease" | "sales", listing: Listing, parsed: ParsedListing) {
  const market = marketForCountry(listing.country);
  const override = listing.appraisal_overrides_json?.[kind];
  const hasOverride = override && Object.values(override).some(value => value != null);
  const automated = kind === "lease" ? parsed.domainAvm?.rentalEstimate : parsed.domainAvm?.valuation;
  const amount = market.country === "US"
    ? kind === "lease" ? parsed.usProperty?.rentMonthly?.mid : parsed.usProperty?.valuation?.mid
    : kind === "lease" ? parsed.domainAvm?.rentalEstimate?.weeklyRent : parsed.domainAvm?.valuation?.midPrice;
  const hasAutomatedEstimate = market.country === "US"
    ? amount != null && Number.isFinite(amount) && amount > 0
    : amount != null && Number.isFinite(amount) && amount > 0 && (automated?.confidence === "high" || automated?.confidence === "medium");
  const guide = kind === "lease" ? `${market.rentPeriod === "month" ? "monthly" : "weekly"} rental guide` : "estimated sale price range";
  const basis = hasOverride ? "override" : hasAutomatedEstimate ? "automated" : "comparables";
  const description = hasOverride
    ? `The ${guide} uses the agent’s appraisal figures.`
    : hasAutomatedEstimate
      ? `The ${guide} is anchored to an automated property estimate.`
      : `The ${guide} is informed by ${kind === "lease" ? "comparable rental listings" : "comparable sale evidence"}.`;
  const context = kind === "lease"
    ? "Selected advertised rents provide comparison evidence and may differ from achieved rents. Review property condition, inclusions and differences between the properties before setting the rent."
    : "Selected sold properties provide comparison evidence; advertised asking prices are separate context and are not achieved sale prices. Review property condition and differences between the properties before setting an asking price.";
  return { basis, description, methodology: `${description} ${context}` };
}

export function rentalGuideComparison(min: number | null | undefined, max: number | null | undefined, rents: readonly (number | null | undefined)[]): "below" | "above" | null {
  const available = rents.filter((rent): rent is number => rent != null && Number.isFinite(rent) && rent > 0);
  if (!available.length || min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  return max < Math.min(...available) ? "below" : min > Math.max(...available) ? "above" : null;
}
