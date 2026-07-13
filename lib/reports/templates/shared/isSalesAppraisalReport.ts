import type { FinalReportJson } from "@/lib/types";

export function isSalesAppraisalTemplateId(templateId: string | null | undefined) {
  return Boolean(templateId?.includes("sales-appraisal"));
}

export function isSalesAppraisalReport(report: Pick<FinalReportJson, "template_id">) {
  return isSalesAppraisalTemplateId(report.template_id);
}
