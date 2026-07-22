import { getTemplatesForProduct } from "@/lib/templates/catalog";
import { DEFAULT_SALES_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/sales-appraisal/ids";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import type { ReportTemplateCatalogEntry } from "@/lib/templates/types";

export { DEFAULT_SALES_APPRAISAL_TEMPLATE_ID, isSalesAppraisalTemplateId };

/** Platform sales appraisal templates for agency-facing picker. */
export function getSalesAppraisalTemplates(): ReportTemplateCatalogEntry[] {
  return getTemplatesForProduct("sales_appraisal").filter(
    (entry): entry is ReportTemplateCatalogEntry =>
      entry.kind === "report" && entry.scope === "platform",
  );
}

export function resolveSalesAppraisalTemplateSelection(
  templateId: string | null | undefined,
) {
  if (!templateId) {
    return DEFAULT_SALES_APPRAISAL_TEMPLATE_ID;
  }
  return getTemplatesForProduct("sales_appraisal").some(
    (template) => template.kind === "report" && template.id === templateId,
  )
    ? templateId
    : DEFAULT_SALES_APPRAISAL_TEMPLATE_ID;
}
