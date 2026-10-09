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

  return {
    ...base,
    // Advertising prices belong to this document, even when intentionally blank.
    // An attached appraisal supplies metrics, never a replacement asking price.
    str: { ...base.str, ...strSource.str },
    ltr: { ...base.ltr, ...leaseSource.ltr },
    str_yield: base.str_yield ?? strSource.str_yield ?? null,
    ltr_enrichment: base.ltr_enrichment ?? leaseSource.ltr_enrichment ?? null,
  };
}
