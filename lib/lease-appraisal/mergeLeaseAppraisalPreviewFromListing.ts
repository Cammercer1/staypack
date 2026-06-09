import { ltrEnrichmentFromParsed } from "@/lib/lease-appraisal/ltrEnrichmentFromParsed";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import type { FinalReportJson, Listing } from "@/lib/types";

/** Keep page-2 comps and rent band in sync with listing appraisal data during wizard preview. */
export function mergeLeaseAppraisalPreviewFromListing(
  report: FinalReportJson,
  listing: Listing,
): FinalReportJson {
  const parsed = listing.scraped_listing_json;
  if (!parsed) {
    return report;
  }

  const ltrEnrichment = ltrEnrichmentFromParsed(parsed);
  if (!ltrEnrichment) {
    return report;
  }

  const weeklyMin = parsed.rentalAppraisal?.weeklyMin ?? report.ltr?.weekly_min ?? null;
  const weeklyMax = parsed.rentalAppraisal?.weeklyMax ?? report.ltr?.weekly_max ?? null;
  const weeklyMidpoint =
    parsed.rentalAppraisal?.weeklyMidpoint ?? report.ltr?.weekly_midpoint ?? null;
  const annualMidpoint =
    weeklyMidpoint != null ? weeklyMidpoint * 52 : report.ltr?.annual_midpoint ?? null;

  const rentRangeLabel =
    weeklyMin != null && weeklyMax != null
      ? formatWeeklyRentRange(weeklyMin, weeklyMax)
      : weeklyMidpoint != null
        ? formatWeeklyRentRange(weeklyMidpoint, weeklyMidpoint)
        : report.property.display_price;

  return {
    ...report,
    property: {
      ...report.property,
      display_price: rentRangeLabel || report.property.display_price,
    },
    ltr: {
      ...report.ltr,
      weekly_min: weeklyMin,
      weekly_max: weeklyMax,
      weekly_midpoint: weeklyMidpoint,
      annual_midpoint: annualMidpoint,
    },
    ltr_enrichment: ltrEnrichment,
  };
}
