import { getTemplatesForProduct } from "@/lib/templates/catalog";
import {
  DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID,
  HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
} from "@/lib/reports/templates/lease-appraisal/ids";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { ReportTemplateCatalogEntry } from "@/lib/templates/types";

export { DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID, isLeaseAppraisalTemplateId };

/** Platform lease templates for agency-facing picker (excludes account-scoped layouts). */
export function getLeaseAppraisalTemplates(): ReportTemplateCatalogEntry[] {
  return getTemplatesForProduct("lease").filter(
    (entry): entry is ReportTemplateCatalogEntry =>
      entry.kind === "report" && entry.scope === "platform",
  );
}

export function resolveLeaseAppraisalTemplateSelection(
  templateId: string | null | undefined,
) {
  if (
    !templateId ||
    templateId === HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID
  ) {
    return DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID;
  }
  return getLeaseAppraisalTemplates().some((t) => t.id === templateId)
    ? templateId
    : DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID;
}
