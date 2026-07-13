import { saleCalloutFromReport } from "@/lib/sales-appraisal/formatSaleCallout";
import { formatSalePriceRange } from "@/lib/sales/computeSalePriceBand";
import type { FinalReportJson } from "@/lib/types";

/** Sale price range for brochure classic price column. */
export function resolveSalesAppraisalBrochurePriceValue(
  report: FinalReportJson,
): string | null {
  if (report.sale_estimate) {
    const fromEstimate = saleCalloutFromReport(report.sale_estimate);
    if (fromEstimate) {
      return fromEstimate;
    }
  }

  const displayPrice = report.property.display_price?.trim() ?? "";
  if (displayPrice) {
    return displayPrice;
  }

  const mid = report.sale_estimate?.price_midpoint;
  if (mid != null) {
    return formatSalePriceRange(mid, mid);
  }

  return null;
}
