export const DEFAULT_REPORT_TEMPLATE_ID = "classic";

export const REPORT_TEMPLATE_IDS = [DEFAULT_REPORT_TEMPLATE_ID] as const;

export type ReportTemplateId = (typeof REPORT_TEMPLATE_IDS)[number];

export function isValidReportTemplateId(id: string): boolean {
  return (REPORT_TEMPLATE_IDS as readonly string[]).includes(id);
}
