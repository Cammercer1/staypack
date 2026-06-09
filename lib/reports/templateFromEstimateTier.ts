import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import type { Agency, Report } from "@/lib/types";

export function resolveReportTemplateIdForReport(
  agency: Agency,
  report: Report,
): string {
  return resolveReportTemplateId(agency, report);
}
