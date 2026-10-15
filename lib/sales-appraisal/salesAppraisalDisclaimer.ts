import { SALES_APPRAISAL_COMPARABLE_DISCLAIMER } from "./comparableEvidenceCopy";
import { DEFAULT_DISCLAIMER } from "@/lib/types";

export const SALES_APPRAISAL_DISCLAIMER =
  "This sales appraisal is indicative only and reflects market conditions and comparable sale evidence at the time of preparation. The sale price achieved may vary depending on the property's condition, presentation, marketing, buyer demand and negotiation. It is not a formal valuation or price guarantee. Vendors should make their own enquiries and obtain independent advice.";

function isStrDefaultDisclaimer(value: string) {
  return value.replace(/\s+/g, " ") === DEFAULT_DISCLAIMER.replace(/\s+/g, " ");
}

export function resolveSalesAppraisalDisclaimer(value: string | null | undefined) {
  const trimmed = value?.trim();
  return !trimmed || isStrDefaultDisclaimer(trimmed) ? SALES_APPRAISAL_DISCLAIMER : trimmed;
}

export function resolveSalesAppraisalComparableDisclaimer(value: string | null | undefined) {
  const trimmed = value?.trim();
  return !trimmed || isStrDefaultDisclaimer(trimmed) || trimmed === SALES_APPRAISAL_DISCLAIMER
    ? SALES_APPRAISAL_COMPARABLE_DISCLAIMER : trimmed;
}

/** Apply only while preparing a draft/new version; stored published snapshots stay unchanged. */
export function resolveSalesAppraisalCopyDisclaimers<T extends { disclaimer: string; comparable_disclaimer?: string }>(copy: T): T {
  return { ...copy, disclaimer: resolveSalesAppraisalDisclaimer(copy.disclaimer),
    comparable_disclaimer: resolveSalesAppraisalComparableDisclaimer(copy.comparable_disclaimer) };
}
