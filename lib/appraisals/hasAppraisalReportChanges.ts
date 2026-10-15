import { resolveAppraisalInput, type AppraisalKind } from "@/lib/appraisals/resolveAppraisalInput";
import { ltrEnrichmentFromParsed } from "@/lib/lease-appraisal/ltrEnrichmentFromParsed";
import { salesEnrichmentFromParsed } from "@/lib/sales-appraisal/salesEnrichmentFromParsed";
import type { Listing, Report } from "@/lib/types";

function sameCards<T extends object>(current: T[], saved: T[]) {
  return current.length === saved.length && current.every((card, index) =>
    (Object.keys(card) as (keyof T)[]).every((key) =>
      (card[key] ?? null) === (saved[index][key] ?? null),
    ),
  );
}

/** Compare persisted evidence with the report snapshot, including after a reload. */
export function hasAppraisalReportChanges(listing: Listing, report: Report, kind: AppraisalKind) {
  const saved = report.final_report_json;
  if (!saved) return false;
  if (report.template_id && report.template_id !== saved.template_id) return true;
  const parsed = resolveAppraisalInput(listing);
  if (kind === "lease") {
    const appraisal = parsed.rentalAppraisal;
    return (appraisal?.weeklyMin ?? null) !== (saved.ltr.weekly_min ?? null) ||
      (appraisal?.weeklyMax ?? null) !== (saved.ltr.weekly_max ?? null) ||
      (appraisal?.weeklyMidpoint ?? null) !== (saved.ltr.weekly_midpoint ?? null) ||
      !sameCards(ltrEnrichmentFromParsed(parsed)?.comps ?? [], saved.ltr_enrichment?.comps ?? []);
  }
  const appraisal = parsed.salesAppraisal;
  return (appraisal?.priceMin ?? null) !== (saved.sale_estimate?.price_min ?? null) ||
    (appraisal?.priceMax ?? null) !== (saved.sale_estimate?.price_max ?? null) ||
    (appraisal?.priceMidpoint ?? null) !== (saved.sale_estimate?.price_midpoint ?? null) ||
    !sameCards(salesEnrichmentFromParsed(parsed)?.comps ?? [], saved.sales_enrichment?.comps ?? []);
}
