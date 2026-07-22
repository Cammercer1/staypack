import { LEASE_APPRAISAL_COMPARABLE_DISCLAIMER } from "@/lib/lease-appraisal/comparableEvidenceCopy";
import { DEFAULT_DISCLAIMER } from "@/lib/types";

export const LEASE_APPRAISAL_DISCLAIMER =
  "This rental appraisal is indicative only and reflects market conditions and comparable advertised rents at the time of preparation. Actual rent achieved may vary depending on the property's condition, presentation, inclusions, lease terms and tenant demand. It is not a formal valuation or rental guarantee. Owners should make their own enquiries and obtain independent advice.";

function isStrDefaultDisclaimer(value: string | null | undefined) {
  return value?.trim() === DEFAULT_DISCLAIMER;
}

export function resolveLeaseAppraisalDisclaimer(
  value: string | null | undefined,
) {
  const trimmed = value?.trim();
  if (!trimmed || isStrDefaultDisclaimer(trimmed)) {
    return LEASE_APPRAISAL_DISCLAIMER;
  }
  return trimmed;
}

export function resolveLeaseAppraisalComparableDisclaimer(
  value: string | null | undefined,
) {
  const trimmed = value?.trim();
  if (
    !trimmed ||
    isStrDefaultDisclaimer(trimmed) ||
    trimmed === LEASE_APPRAISAL_DISCLAIMER
  ) {
    return LEASE_APPRAISAL_COMPARABLE_DISCLAIMER;
  }
  return trimmed;
}

export function resolveLeaseAppraisalCopyDisclaimers<
  T extends { disclaimer: string; comparable_disclaimer: string },
>(copy: T): T {
  return {
    ...copy,
    disclaimer: resolveLeaseAppraisalDisclaimer(copy.disclaimer),
    comparable_disclaimer: resolveLeaseAppraisalComparableDisclaimer(
      copy.comparable_disclaimer,
    ),
  };
}
