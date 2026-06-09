import {
  applyHavenBrandKitToReport,
  getHavenAgent,
  HAVEN_AGENT_PHOTO_CLASS,
  HAVEN_BRAND,
  HAVEN_GRADIENT,
  HAVEN_LEASE_APPRAISAL_AGENT_PHOTO_CLASS,
} from "@/lib/branding/kits/haven";
import type { FinalReportJson } from "@/lib/types";

export {
  HAVEN_BRAND,
  HAVEN_AGENT_PHOTO_CLASS,
  HAVEN_LEASE_APPRAISAL_AGENT_PHOTO_CLASS,
  HAVEN_GRADIENT,
  getHavenAgent,
  applyHavenBrandKitToReport,
};

/** Managed Haven delivery templates only (not generic `*-lease-appraisal` family ids). */
export function isHavenPropertiesTemplateId(
  templateId: string | null | undefined,
): boolean {
  return Boolean(templateId?.startsWith("haven-properties"));
}

/** @deprecated Use applyHavenBrandKitToReport via applyBrandForTemplate */
export function applyHavenBrandToReport(report: FinalReportJson) {
  return applyHavenBrandKitToReport(report);
}

/** @deprecated Use applyHavenBrandKitToReport via applyBrandForTemplate */
export function applyHavenLeaseAppraisalBrandToReport(report: FinalReportJson) {
  return applyHavenBrandKitToReport(report);
}
