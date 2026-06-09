import { rentCalloutFromReport } from "@/lib/lease-appraisal/formatRentCallout";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import type { FinalReportJson } from "@/lib/types";

/** True when display_price looks like a weekly rent band, not a sale price. */
function isLikelyWeeklyRentDisplay(value: string): boolean {
  if (/per week|\bpw\b|\/wk/i.test(value)) {
    return true;
  }
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return false;
  }
  const amount = Number.parseInt(digits, 10);
  return amount > 0 && amount < 50_000;
}

/** Weekly rent range for brochure classic price column (excludes sale listing price). */
export function resolveLeaseBrochurePriceValue(
  report: FinalReportJson,
): string | null {
  if (report.ltr) {
    const fromLtr = rentCalloutFromReport(report.ltr);
    if (fromLtr) {
      return fromLtr;
    }
  }

  const displayPrice = report.property.display_price?.trim() ?? "";
  if (displayPrice && isLikelyWeeklyRentDisplay(displayPrice)) {
    return displayPrice.replace(/\s*per week\s*$/i, "").trim();
  }

  const mid = report.ltr?.weekly_midpoint;
  if (mid != null) {
    return formatWeeklyRentRange(mid, mid).replace(/\s*per week\s*$/i, "").trim();
  }

  return null;
}
