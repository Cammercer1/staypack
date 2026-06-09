import { formatCurrency } from "@/lib/reports/formatters";
import type { FinalReportJson } from "@/lib/types";

/** Label for STR price slots on brochure-style page 1 (stat bars, sidebars). */
export const STR_ANNUAL_REVENUE_LABEL = "Annual revenue estimate";

/** Formatted annual STR revenue for brochure copy — not the listing sale price. */
export function resolveStrBrochurePriceValue(
  report: FinalReportJson,
): string | null {
  const revenue = report.str?.annual_revenue;
  if (revenue == null || Number.isNaN(revenue)) {
    return null;
  }
  const formatted = formatCurrency(revenue);
  return formatted === "—" ? null : formatted;
}

export function resolveStrBrochurePriceLabel(): string {
  return STR_ANNUAL_REVENUE_LABEL;
}
