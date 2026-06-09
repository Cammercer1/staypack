import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { FinalReportJson } from "@/lib/types";

/** Distinguishes page-1 layout intent across collateral types. */
export type ReportPageVariant = "str" | "lease" | "sale";

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
  return isLeaseAppraisalTemplateId(report.template_id) ? "lease" : "str";
}

export function isLeasePageVariant(variant: ReportPageVariant) {
  return variant === "lease";
}

export function isSalePageVariant(variant: ReportPageVariant) {
  return variant === "sale";
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
  if (variant === "sale") return "Price guide";
  return "STR Revenue";
}

export function reportTypeBannerLabel(variant: ReportPageVariant) {
  if (variant === "lease") return "Long-term rental appraisal";
  if (variant === "sale") return "For sale";
  return "Short-Term Rental Report";
}

export function pageOneHeaderTagline(variant: ReportPageVariant) {
  if (variant === "lease") return "Long-term rental potential";
  if (variant === "sale") return "Property for sale";
  return "Short-Term Rental Potential";
}

export function landmarkBannerTitle(variant: ReportPageVariant) {
  if (variant === "lease") return "Lease appraisal";
  if (variant === "sale") return "Property brochure";
  return "STR Revenue Report";
}
