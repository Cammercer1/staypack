/** @deprecated Aliased to *-detailed at normalize time */
export const CLASSIC_LIGHT_TEMPLATE_ID = "classic-light";
export const CLASSIC_DETAILED_TEMPLATE_ID = "classic-detailed";

/** @deprecated Use classic-detailed */
export const LEGACY_CLASSIC_TEMPLATE_ID = "classic";

/** @deprecated Aliased to *-detailed at normalize time */
export const BOLD_LIGHT_TEMPLATE_ID = "bold-light";
export const BOLD_DETAILED_TEMPLATE_ID = "bold-detailed";

/** @deprecated Aliased to *-detailed at normalize time */
export const GALLERY_LIGHT_TEMPLATE_ID = "gallery-light";
export const GALLERY_DETAILED_TEMPLATE_ID = "gallery-detailed";

/** @deprecated Aliased to *-detailed at normalize time */
export const EDITORIAL_LIGHT_TEMPLATE_ID = "editorial-light";
export const EDITORIAL_DETAILED_TEMPLATE_ID = "editorial-detailed";

/** @deprecated Aliased to *-detailed at normalize time */
export const SPLIT_LIGHT_TEMPLATE_ID = "split-light";
export const SPLIT_DETAILED_TEMPLATE_ID = "split-detailed";

/** @deprecated Aliased to *-detailed at normalize time */
export const REFINED_LIGHT_TEMPLATE_ID = "refined-light";
export const REFINED_DETAILED_TEMPLATE_ID = "refined-detailed";

/** @deprecated Aliased to *-detailed at normalize time */
export const MINIMALIST_LIGHT_TEMPLATE_ID = "minimalist-light";
export const MINIMALIST_DETAILED_TEMPLATE_ID = "minimalist-detailed";
export const DEFAULT_REPORT_TEMPLATE_ID = MINIMALIST_DETAILED_TEMPLATE_ID;

/** @deprecated Aliased to *-detailed at normalize time */
export const LANDMARK_LIGHT_TEMPLATE_ID = "landmark-light";
export const LANDMARK_DETAILED_TEMPLATE_ID = "landmark-detailed";

const DEPRECATED_LIGHT_TEMPLATE_IDS = [
  CLASSIC_LIGHT_TEMPLATE_ID,
  BOLD_LIGHT_TEMPLATE_ID,
  GALLERY_LIGHT_TEMPLATE_ID,
  EDITORIAL_LIGHT_TEMPLATE_ID,
  SPLIT_LIGHT_TEMPLATE_ID,
  REFINED_LIGHT_TEMPLATE_ID,
  MINIMALIST_LIGHT_TEMPLATE_ID,
  LANDMARK_LIGHT_TEMPLATE_ID,
] as const;

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
  CLASSIC_DETAILED_TEMPLATE_ID,
  BOLD_DETAILED_TEMPLATE_ID,
  GALLERY_DETAILED_TEMPLATE_ID,
  EDITORIAL_DETAILED_TEMPLATE_ID,
  SPLIT_DETAILED_TEMPLATE_ID,
  REFINED_DETAILED_TEMPLATE_ID,
  MINIMALIST_DETAILED_TEMPLATE_ID,
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

function aliasLightTemplateId(id: string): string {
  if (id.endsWith("-light")) {
    return id.replace(/-light$/, "-detailed");
  }
  if (id === LEGACY_CLASSIC_TEMPLATE_ID) {
    return CLASSIC_DETAILED_TEMPLATE_ID;
  }
  return id;
}

export function normalizeReportTemplateId(id: string | null | undefined) {
  if (!id) {
    return DEFAULT_REPORT_TEMPLATE_ID;
  }

  const aliased = aliasLightTemplateId(id);

  if ((REPORT_TEMPLATE_IDS as readonly string[]).includes(aliased)) {
    return aliased;
  }

  return DEFAULT_REPORT_TEMPLATE_ID;
}

export function isValidReportTemplateId(id: string) {
  const aliased = aliasLightTemplateId(id);
  return (REPORT_TEMPLATE_IDS as readonly string[]).includes(aliased);
}

export function isDeprecatedLightTemplateId(id: string) {
  return (DEPRECATED_LIGHT_TEMPLATE_IDS as readonly string[]).includes(
    id as (typeof DEPRECATED_LIGHT_TEMPLATE_IDS)[number],
  );
}

export function isClassicTemplateId(id: string) {
  return normalizeReportTemplateId(id) === CLASSIC_DETAILED_TEMPLATE_ID;
}

/** STR template ids accepted by APIs (detailed variants only; no deprecated *-light). */
export function isSelectableStrTemplateId(id: string): boolean {
  if (isDeprecatedLightTemplateId(id) || id === LEGACY_CLASSIC_TEMPLATE_ID) {
    return false;
  }

  const normalized = normalizeReportTemplateId(id);
  if (normalized.includes("lease-appraisal")) {
    return false;
  }

  return (REPORT_TEMPLATE_IDS as readonly string[]).includes(normalized);
}
