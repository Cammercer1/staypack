/** @deprecated Import from @/lib/copy/resolveCopyForTemplate */
export {
  collateralForReportTemplate,
  resolveReportCopyForTemplate as resolveReportForTemplatePreview,
  resolveReportCopyForTemplate,
  type CopyWithVariants,
  type ResolvedCopyForTemplate,
} from "@/lib/copy/resolveCopyForTemplate";

import { resolveReportCopyForTemplate } from "@/lib/copy/resolveCopyForTemplate";
import type { FinalReportJson } from "@/lib/types";

/** @deprecated Use resolveReportCopyForTemplate */
export function resolveReportCopyBlurb(
  report: FinalReportJson,
  options?: Parameters<typeof resolveReportCopyForTemplate>[1],
): Pick<FinalReportJson["copy"], "blurb"> {
  const resolved = resolveReportCopyForTemplate(report, options);
  return { blurb: resolved.copy.blurb };
}

/** @deprecated Use resolveCopyForTemplate with normalizeBlurbVariantsFromCopy */
export { normalizeBlurbVariantsFromCopy as normalizeReportBlurbVariants } from "@/lib/copy/blurbVariantEnforce";
