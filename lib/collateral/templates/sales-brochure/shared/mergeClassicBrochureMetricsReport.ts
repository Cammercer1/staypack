import type { FinalReportJson } from "@/lib/types";

/** Merges listing price + STR + LTR fields onto a brochure/report shape for Classic page 1. */
export function mergeClassicBrochureMetricsReport(
  base: FinalReportJson,
  options?: {
    strReport?: FinalReportJson | null;
    leaseReport?: FinalReportJson | null;
  },
): FinalReportJson {
  const strSource = options?.strReport ?? base;
  const leaseSource = options?.leaseReport ?? base;

  const displayPrice =
    base.property.display_price?.trim() ||
    strSource.property.display_price?.trim() ||
    leaseSource.property.display_price?.trim() ||
    "";

  return {
    ...base,
    property: {
      ...base.property,
      display_price: displayPrice,
    },
    str: { ...base.str, ...strSource.str },
    ltr: { ...base.ltr, ...leaseSource.ltr },
    str_yield: base.str_yield ?? strSource.str_yield ?? null,
    ltr_enrichment: base.ltr_enrichment ?? leaseSource.ltr_enrichment ?? null,
  };
}
