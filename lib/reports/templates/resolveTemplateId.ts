import { reportTemplateIdFromAirbticsTier } from "@/lib/reports/templateFromEstimateTier";
import {
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
  normalizeReportTemplateId,
} from "@/lib/reports/templates/ids";
import type { Agency, FinalReportJson, Report } from "@/lib/types";

export function resolveReportTemplateId(agency: Agency, report: Report): string {
  // Explicit per-report choice wins over everything.
  if (report.template_id && isValidReportTemplateId(report.template_id)) {
    return normalizeReportTemplateId(report.template_id);
  }

  // Agency-level default is next in priority.
  if (agency.report_template_id && isValidReportTemplateId(agency.report_template_id)) {
    return normalizeReportTemplateId(agency.report_template_id);
  }

  // If nothing explicit is set, fall back to the estimate-tier implied layout.
  const fromEstimateTier = reportTemplateIdFromAirbticsTier(report.airbtics_tier);
  if (fromEstimateTier) {
    return fromEstimateTier;
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}

export function resolveTemplateIdFromFinalReport(report: FinalReportJson): string {
  if (report.template_id && isValidReportTemplateId(report.template_id)) {
    return normalizeReportTemplateId(report.template_id);
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}
