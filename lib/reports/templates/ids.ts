export const CLASSIC_LIGHT_TEMPLATE_ID = "classic-light";
export const CLASSIC_DETAILED_TEMPLATE_ID = "classic-detailed";
export const DEFAULT_REPORT_TEMPLATE_ID = CLASSIC_LIGHT_TEMPLATE_ID;

/** @deprecated Use classic-light */
export const LEGACY_CLASSIC_TEMPLATE_ID = "classic";

export const REPORT_TEMPLATE_IDS = [
  CLASSIC_LIGHT_TEMPLATE_ID,
  CLASSIC_DETAILED_TEMPLATE_ID,
] as const;

export type ReportTemplateId = (typeof REPORT_TEMPLATE_IDS)[number];

export function normalizeReportTemplateId(id: string | null | undefined) {
  if (!id || id === LEGACY_CLASSIC_TEMPLATE_ID) {
    return DEFAULT_REPORT_TEMPLATE_ID;
  }

  if ((REPORT_TEMPLATE_IDS as readonly string[]).includes(id)) {
    return id;
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}

export function isValidReportTemplateId(id: string) {
  return (
    (REPORT_TEMPLATE_IDS as readonly string[]).includes(id) ||
    id === LEGACY_CLASSIC_TEMPLATE_ID
  );
}

export function isClassicTemplateId(id: string) {
  const normalized = normalizeReportTemplateId(id);
  return (
    normalized === CLASSIC_LIGHT_TEMPLATE_ID ||
    normalized === CLASSIC_DETAILED_TEMPLATE_ID
  );
}
