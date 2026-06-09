import { blurbVariantsAreCollapsed } from "@/lib/copy/blurbVariantsQuality";
import { normalizeBlurbVariantsFromCopy } from "@/lib/copy/blurbVariantEnforce";
import type { LeaseAppraisalCopy } from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import type { FinalReportJson } from "@/lib/types";

/** Preserve stored variants across editor saves; avoid collapsing to a single blurb. */
export function mergeLeaseAppraisalCopyVariants(
  incoming: LeaseAppraisalCopy,
  existing?: FinalReportJson["copy"] | LeaseAppraisalCopy | null,
): LeaseAppraisalCopy {
  const existingVariants = (existing as LeaseAppraisalCopy | undefined)
    ?.blurb_variants;

  if (
    incoming.blurb_variants &&
    !blurbVariantsAreCollapsed(incoming.blurb_variants)
  ) {
    return incoming;
  }

  if (existingVariants && !blurbVariantsAreCollapsed(existingVariants)) {
    return {
      ...incoming,
      blurb_variants: existingVariants,
    };
  }

  return {
    ...incoming,
    blurb_variants: normalizeBlurbVariantsFromCopy({
      blurb: incoming.blurb,
      blurb_variants: incoming.blurb_variants ?? existingVariants,
    }),
  };
}
