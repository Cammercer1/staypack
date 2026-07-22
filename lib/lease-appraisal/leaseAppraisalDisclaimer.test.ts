import { describe, expect, it } from "vitest";
import { LEASE_APPRAISAL_COMPARABLE_DISCLAIMER } from "@/lib/lease-appraisal/comparableEvidenceCopy";
import {
  LEASE_APPRAISAL_DISCLAIMER,
  resolveLeaseAppraisalComparableDisclaimer,
  resolveLeaseAppraisalCopyDisclaimers,
  resolveLeaseAppraisalDisclaimer,
} from "@/lib/lease-appraisal/leaseAppraisalDisclaimer";
import { DEFAULT_DISCLAIMER } from "@/lib/types";

describe("lease appraisal disclaimers", () => {
  it("replaces the STR default with lease-specific wording", () => {
    expect(resolveLeaseAppraisalDisclaimer(DEFAULT_DISCLAIMER)).toBe(
      LEASE_APPRAISAL_DISCLAIMER,
    );
    expect(resolveLeaseAppraisalComparableDisclaimer(DEFAULT_DISCLAIMER)).toBe(
      LEASE_APPRAISAL_COMPARABLE_DISCLAIMER,
    );
  });

  it("uses lease defaults when disclaimer fields are blank", () => {
    expect(resolveLeaseAppraisalDisclaimer(" ")).toBe(
      LEASE_APPRAISAL_DISCLAIMER,
    );
    expect(resolveLeaseAppraisalComparableDisclaimer(null)).toBe(
      LEASE_APPRAISAL_COMPARABLE_DISCLAIMER,
    );
  });

  it("preserves deliberately customised disclaimer copy", () => {
    const custom = "Custom agency rental appraisal disclaimer.";
    const resolved = resolveLeaseAppraisalCopyDisclaimers({
      disclaimer: custom,
      comparable_disclaimer: custom,
    });

    expect(resolved.disclaimer).toBe(custom);
    expect(resolved.comparable_disclaimer).toBe(custom);
  });
});
