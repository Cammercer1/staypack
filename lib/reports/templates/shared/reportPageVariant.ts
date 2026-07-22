import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import type { FinalReportJson } from "@/lib/types";

/** Distinguishes page-1 layout intent across collateral types. */
export type ReportPageVariant = "str" | "lease" | "sale" | "sales_appraisal";

export type ReportPageOneProps = {
  report: FinalReportJson;
  /** Explicit variant from the template composer; falls back to report.template_id when omitted. */
  reportVariant?: ReportPageVariant;
};

export function resolveReportPageVariant(
  report: Pick<FinalReportJson, "template_id">,
  explicit?: ReportPageVariant,
): ReportPageVariant {
  if (explicit) {
    return explicit;
  }
  if (isSalesAppraisalTemplateId(report.template_id)) {
    return "sales_appraisal";
  }
  return isLeaseAppraisalTemplateId(report.template_id) ? "lease" : "str";
}

export function isLeasePageVariant(variant: ReportPageVariant) {
  return variant === "lease";
}

export function isSalePageVariant(variant: ReportPageVariant) {
  return variant === "sale";
}

export function isSalesAppraisalPageVariant(variant: ReportPageVariant) {
  return variant === "sales_appraisal";
}

export function isStrPageVariant(variant: ReportPageVariant) {
  return variant === "str";
}

/** Guest count is STR-only; sale uses land area in brochure layouts instead. */
export function showGuestStat(variant: ReportPageVariant) {
  return variant === "str";
}

export function revenueSectionTitle(variant: ReportPageVariant) {
  if (variant === "lease") return "Estimated weekly rent";
  if (variant === "sales_appraisal") return "Estimated sale price";
  if (variant === "sale") return "Price guide";
  return "STR Revenue";
}

export function reportTypeBannerLabel(variant: ReportPageVariant) {
  if (variant === "lease") return "Rental appraisal";
  if (variant === "sales_appraisal") return "Property appraisal";
  if (variant === "sale") return "For sale";
  return "Short-term rental appraisal";
}

export function pageOneHeaderTagline(variant: ReportPageVariant) {
  if (variant === "lease") return "Rental appraisal";
  if (variant === "sales_appraisal") return "Property appraisal";
  if (variant === "sale") return "Property for sale";
  return "Short-term rental appraisal";
}

export function landmarkBannerTitle(variant: ReportPageVariant) {
  if (variant === "lease") return "Rental appraisal";
  if (variant === "sales_appraisal") return "Property appraisal";
  if (variant === "sale") return "Property brochure";
  return "Short-term rental appraisal";
}
