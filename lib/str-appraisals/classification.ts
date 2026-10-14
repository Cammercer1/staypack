import { REPORT_TEMPLATE_IDS } from "@/lib/reports/templates/ids";
import type { Report } from "@/lib/types";

/** Positive evidence for legacy consumers; the workspace uses str_appraisals. */
export function isConfirmedStrReport(report: Pick<Report, "template_id" | "final_report_json">) {
  const id = report.template_id ?? "";
  const version = report.final_report_json?.version;
  if (id.includes("lease-appraisal") || id.includes("sales-appraisal") || version === "lease_appraisal_v1" || version === "sales_appraisal_v1") return false;
  return version === "standard_2_page_v1" || (REPORT_TEMPLATE_IDS as readonly string[]).includes(id);
}
