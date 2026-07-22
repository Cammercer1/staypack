import { ltrEnrichmentFromParsed } from "@/lib/lease-appraisal/ltrEnrichmentFromParsed";
import { resolveLeaseAppraisalCopyDisclaimers } from "@/lib/lease-appraisal/leaseAppraisalDisclaimer";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import type { FinalReportJson, Listing } from "@/lib/types";

/** Keep page-2 comps and rent band in sync with listing appraisal data during wizard preview. */
export function mergeLeaseAppraisalPreviewFromListing(
  report: FinalReportJson,
  listing: Listing,
): FinalReportJson {
  const resolvedReport: FinalReportJson = {
    ...report,
    copy: resolveLeaseAppraisalCopyDisclaimers(report.copy),
  };
  const parsed = listing.scraped_listing_json;
  if (!parsed) {
    return resolvedReport;
  }

  const ltrEnrichment = ltrEnrichmentFromParsed(parsed);
  if (!ltrEnrichment) {
    return resolvedReport;
  }

  const weeklyMin =
    parsed.rentalAppraisal?.weeklyMin ?? resolvedReport.ltr?.weekly_min ?? null;
  const weeklyMax =
    parsed.rentalAppraisal?.weeklyMax ?? resolvedReport.ltr?.weekly_max ?? null;
  const weeklyMidpoint =
    parsed.rentalAppraisal?.weeklyMidpoint ??
    resolvedReport.ltr?.weekly_midpoint ??
    null;
  const annualMidpoint =
    weeklyMidpoint != null
      ? weeklyMidpoint * 52
      : resolvedReport.ltr?.annual_midpoint ?? null;

  const rentRangeLabel =
    weeklyMin != null && weeklyMax != null
      ? formatWeeklyRentRange(weeklyMin, weeklyMax)
      : weeklyMidpoint != null
        ? formatWeeklyRentRange(weeklyMidpoint, weeklyMidpoint)
        : resolvedReport.property.display_price;

  return {
    ...resolvedReport,
    property: {
      ...resolvedReport.property,
      display_price: rentRangeLabel || resolvedReport.property.display_price,
    },
    ltr: {
      ...resolvedReport.ltr,
      weekly_min: weeklyMin,
      weekly_max: weeklyMax,
      weekly_midpoint: weeklyMidpoint,
      annual_midpoint: annualMidpoint,
    },
    ltr_enrichment: ltrEnrichment,
  };
}
