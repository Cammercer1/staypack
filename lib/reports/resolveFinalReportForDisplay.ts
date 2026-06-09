import { resolveReportCopyForTemplate } from "@/lib/copy/resolveCopyForTemplate";
import { applyBrandForTemplate } from "@/lib/branding/applyBrandForTemplate";
import type { FinalReportJson } from "@/lib/types";

/** Brand + blurb resolution for preview, print, and PDF (single pipeline). */
export function resolveFinalReportForDisplay(
  report: FinalReportJson,
  options?: {
    templateId?: string;
    allowDevBlurbLengthMap?: boolean;
  },
): FinalReportJson {
  const templateId = options?.templateId ?? report.template_id;
  const withBrand = applyBrandForTemplate({
    ...report,
    template_id: templateId,
  });
  return resolveReportCopyForTemplate(withBrand, {
    templateId,
    allowDevBlurbLengthMap: options?.allowDevBlurbLengthMap,
  });
}
