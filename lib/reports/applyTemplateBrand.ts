import {
  applyHavenBrandToReport,
  applyHavenLeaseAppraisalBrandToReport,
} from "@/lib/reports/templates/haven-properties/brand";
import { HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { resolveTemplateIdFromFinalReport } from "@/lib/reports/templates/resolveTemplateId";
import type { FinalReportJson } from "@/lib/types";

/** Apply hardcoded template brand kits so print/PDF use the same fonts and assets as the template UI. */
export function applyTemplateBrandToFinalReport(
  report: FinalReportJson,
): FinalReportJson {
  const templateId = resolveTemplateIdFromFinalReport(report);

  if (templateId === "haven-properties-str") {
    return applyHavenBrandToReport(report);
  }

  if (templateId === HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID) {
    return applyHavenLeaseAppraisalBrandToReport(report);
  }

  return report;
}
