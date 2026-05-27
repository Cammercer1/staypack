import {
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
} from "@/lib/reports/templates/ids";
import type { Agency, FinalReportJson, Report } from "@/lib/types";

export function resolveReportTemplateId(agency: Agency, report: Report): string {
  if (report.template_id && isValidReportTemplateId(report.template_id)) {
    return report.template_id;
  }

  if (
    agency.report_template_id &&
    isValidReportTemplateId(agency.report_template_id)
  ) {
    return agency.report_template_id;
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}

export function resolveTemplateIdFromFinalReport(report: FinalReportJson): string {
  if (report.template_id && isValidReportTemplateId(report.template_id)) {
    return report.template_id;
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}
