import { reportTemplateIdFromAirbticsTier } from "@/lib/reports/templateFromEstimateTier";
import {
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
  normalizeReportTemplateId,
} from "@/lib/reports/templates/ids";
import type { Agency, FinalReportJson, Report } from "@/lib/types";

export function resolveReportTemplateId(agency: Agency, report: Report): string {
  const fromEstimateTier = reportTemplateIdFromAirbticsTier(report.airbtics_tier);
  if (fromEstimateTier) {
    return fromEstimateTier;
  }

  if (report.template_id && isValidReportTemplateId(report.template_id)) {
    return normalizeReportTemplateId(report.template_id);
  }

  if (
    agency.report_template_id &&
    isValidReportTemplateId(agency.report_template_id)
  ) {
    return normalizeReportTemplateId(agency.report_template_id);
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}

export function resolveTemplateIdFromFinalReport(report: FinalReportJson): string {
  if (report.template_id && isValidReportTemplateId(report.template_id)) {
    return normalizeReportTemplateId(report.template_id);
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}
