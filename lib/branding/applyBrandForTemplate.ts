import { applyBelleBrandKitToReport } from "@/lib/branding/kits/belle";
import { applyHavenBrandKitToReport } from "@/lib/branding/kits/haven";
import { getTemplateMetadata } from "@/lib/templates/getTemplateMetadata";
import type { FinalReportJson } from "@/lib/types";

const BRAND_KIT_APPLIERS: Record<
  string,
  (report: FinalReportJson) => FinalReportJson
> = {
  belle: applyBelleBrandKitToReport,
  haven: applyHavenBrandKitToReport,
};

export function applyBrandForTemplate(report: FinalReportJson): FinalReportJson {
  const meta = getTemplateMetadata(report.template_id);
  if (!meta || meta.brandMode === "agency") {
    return report;
  }

  if (meta.brandMode === "fixed" && meta.fixedBrandKitId) {
    const apply = BRAND_KIT_APPLIERS[meta.fixedBrandKitId];
    if (apply) {
      return apply(report);
    }
  }

  return report;
}

/** @deprecated Use applyBrandForTemplate */
export function applyTemplateBrandToFinalReport(
  report: FinalReportJson,
): FinalReportJson {
  return applyBrandForTemplate(report);
}
