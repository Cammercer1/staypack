import { describe, expect, it } from "vitest";
import { mergeLeaseAppraisalCopyVariants } from "@/lib/lease-appraisal/mergeLeaseAppraisalCopyVariants";
import type { LeaseAppraisalCopy } from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";

const richVariants = {
  short: "Short.",
  medium: "Medium one.\n\nMedium two.",
  long: "Long one.\n\nLong two.\n\nLong three.",
};

const baseCopy = (): LeaseAppraisalCopy => ({
  heading: "Heading",
  blurb: "Edited single blurb.",
  key_metrics_line: "",
  appeal_points: [],
  supporting_factors: [],
  buyer_checks: [],
  methodology_note: "",
  disclaimer: "",
  comparable_evidence: "",
  comparable_disclaimer: "",
  cta: "",
});

describe("mergeLeaseAppraisalCopyVariants", () => {
  it("preserves existing variants when editor save omits them", () => {
    const merged = mergeLeaseAppraisalCopyVariants(baseCopy(), {
      ...baseCopy(),
      blurb_variants: richVariants,
    });

    expect(merged.blurb_variants).toEqual(richVariants);
  });
});
