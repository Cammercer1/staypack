import { formatSalePriceRange } from "@/lib/sales/computeSalePriceBand";

/** Dollar amount only (sidebar headline). */
export function formatSaleCalloutAmount(priceMin: number, priceMax: number) {
  return formatSalePriceRange(priceMin, priceMax);
}

export function formatSaleCalloutSubline(
  soldCompCount: number | null | undefined,
  forSaleCompCount?: number | null,
) {
  const parts: string[] = [];
  if (soldCompCount != null && soldCompCount > 0) {
    parts.push(
      `${soldCompCount} recently sold ${soldCompCount === 1 ? "property" : "properties"}`,
    );
  }
  if (forSaleCompCount != null && forSaleCompCount > 0) {
    parts.push(
      `${forSaleCompCount} currently for sale`,
    );
  }
  if (parts.length > 0) {
    return `Based on ${parts.join(" and ")} nearby. This is a guide only — not a formal valuation or price guarantee.`;
  }
  return "Indicative guide only — not a formal valuation or price guarantee.";
}

export function saleCalloutFromReport(saleEstimate: {
  price_min: number | null;
  price_max: number | null;
  price_midpoint?: number | null;
}) {
  const min = saleEstimate.price_min;
  const max = saleEstimate.price_max;
  if (min == null || max == null) {
    if (saleEstimate.price_midpoint != null) {
      return formatSalePriceRange(
        saleEstimate.price_midpoint,
        saleEstimate.price_midpoint,
      );
    }
    return null;
  }
  return formatSaleCalloutAmount(min, max);
}
