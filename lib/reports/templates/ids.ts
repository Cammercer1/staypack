export const CLASSIC_LIGHT_TEMPLATE_ID = "classic-light";
export const CLASSIC_DETAILED_TEMPLATE_ID = "classic-detailed";

/** @deprecated Use classic-light */
export const LEGACY_CLASSIC_TEMPLATE_ID = "classic";

export const BOLD_LIGHT_TEMPLATE_ID = "bold-light";
export const BOLD_DETAILED_TEMPLATE_ID = "bold-detailed";

export const GALLERY_LIGHT_TEMPLATE_ID = "gallery-light";
export const GALLERY_DETAILED_TEMPLATE_ID = "gallery-detailed";

export const EDITORIAL_LIGHT_TEMPLATE_ID = "editorial-light";
export const EDITORIAL_DETAILED_TEMPLATE_ID = "editorial-detailed";

export const SPLIT_LIGHT_TEMPLATE_ID = "split-light";
export const SPLIT_DETAILED_TEMPLATE_ID = "split-detailed";

export const REFINED_LIGHT_TEMPLATE_ID = "refined-light";
export const REFINED_DETAILED_TEMPLATE_ID = "refined-detailed";

export const MINIMALIST_LIGHT_TEMPLATE_ID = "minimalist-light";
export const MINIMALIST_DETAILED_TEMPLATE_ID = "minimalist-detailed";
export const DEFAULT_REPORT_TEMPLATE_ID = MINIMALIST_LIGHT_TEMPLATE_ID;

export const LANDMARK_LIGHT_TEMPLATE_ID = "landmark-light";
export const LANDMARK_DETAILED_TEMPLATE_ID = "landmark-detailed";

/** Managed delivery — bespoke Haven Properties STR layout */
export const HAVEN_PROPERTIES_STR_TEMPLATE_ID = "haven-properties-str";

/** Managed delivery — investor lease appraisal (Haven bespoke page 1) */
export const HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID =
  "haven-properties-lease-appraisal";

export {
  CLASSIC_LEASE_APPRAISAL_TEMPLATE_ID,
  BOLD_LEASE_APPRAISAL_TEMPLATE_ID,
  GALLERY_LEASE_APPRAISAL_TEMPLATE_ID,
  EDITORIAL_LEASE_APPRAISAL_TEMPLATE_ID,
  SPLIT_LEASE_APPRAISAL_TEMPLATE_ID,
  REFINED_LEASE_APPRAISAL_TEMPLATE_ID,
  MINIMALIST_LEASE_APPRAISAL_TEMPLATE_ID,
  LANDMARK_LEASE_APPRAISAL_TEMPLATE_ID,
  DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID,
} from "@/lib/reports/templates/lease-appraisal/ids";

export const REPORT_TEMPLATE_IDS = [
  CLASSIC_LIGHT_TEMPLATE_ID,
  CLASSIC_DETAILED_TEMPLATE_ID,
  BOLD_LIGHT_TEMPLATE_ID,
  BOLD_DETAILED_TEMPLATE_ID,
  GALLERY_LIGHT_TEMPLATE_ID,
  GALLERY_DETAILED_TEMPLATE_ID,
  EDITORIAL_LIGHT_TEMPLATE_ID,
  EDITORIAL_DETAILED_TEMPLATE_ID,
  SPLIT_LIGHT_TEMPLATE_ID,
  SPLIT_DETAILED_TEMPLATE_ID,
  REFINED_LIGHT_TEMPLATE_ID,
  REFINED_DETAILED_TEMPLATE_ID,
  MINIMALIST_LIGHT_TEMPLATE_ID,
  MINIMALIST_DETAILED_TEMPLATE_ID,
  LANDMARK_LIGHT_TEMPLATE_ID,
  LANDMARK_DETAILED_TEMPLATE_ID,
  HAVEN_PROPERTIES_STR_TEMPLATE_ID,
  HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
  "classic-lease-appraisal",
  "bold-lease-appraisal",
  "gallery-lease-appraisal",
  "editorial-lease-appraisal",
  "split-lease-appraisal",
  "refined-lease-appraisal",
  "minimalist-lease-appraisal",
  "landmark-lease-appraisal",
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
