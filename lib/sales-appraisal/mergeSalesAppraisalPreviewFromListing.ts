import { salesEnrichmentFromParsed } from "@/lib/sales-appraisal/salesEnrichmentFromParsed";
import { formatSalePriceRange } from "@/lib/sales/computeSalePriceBand";
import type { FinalReportJson, Listing } from "@/lib/types";

/** Keep page-2 comps and price band in sync with listing appraisal data during wizard preview. */
export function mergeSalesAppraisalPreviewFromListing(
  report: FinalReportJson,
  listing: Listing,
): FinalReportJson {
  const parsed = listing.scraped_listing_json;
  if (!parsed) {
    return report;
  }

  const salesEnrichment = salesEnrichmentFromParsed(parsed);
  if (!salesEnrichment) {
    return report;
  }

  const priceMin =
    parsed.salesAppraisal?.priceMin ?? report.sale_estimate?.price_min ?? null;
  const priceMax =
    parsed.salesAppraisal?.priceMax ?? report.sale_estimate?.price_max ?? null;
  const priceMidpoint =
    parsed.salesAppraisal?.priceMidpoint ??
    report.sale_estimate?.price_midpoint ??
    null;

  const priceRangeLabel =
    priceMin != null && priceMax != null
      ? formatSalePriceRange(priceMin, priceMax)
      : priceMidpoint != null
        ? formatSalePriceRange(priceMidpoint, priceMidpoint)
        : report.property.display_price;

  return {
    ...report,
    property: {
      ...report.property,
      display_price: priceRangeLabel || report.property.display_price,
    },
    sale_estimate: {
      price_min: priceMin,
      price_max: priceMax,
      price_midpoint: priceMidpoint,
    },
    sales_enrichment: salesEnrichment,
  };
}
