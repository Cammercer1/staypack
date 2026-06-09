import type { FinalReportJson } from "@/lib/types";

export function isLeaseAppraisalTemplateId(templateId: string | null | undefined) {
  return Boolean(templateId?.includes("lease-appraisal"));
}

export function isLeaseAppraisalReport(report: Pick<FinalReportJson, "template_id">) {
  return isLeaseAppraisalTemplateId(report.template_id);
}
