import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";

/** Dollar amount only (sidebar headline). */
export function formatRentCalloutAmount(weeklyMin: number, weeklyMax: number) {
  const formatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
  if (weeklyMin === weeklyMax) {
    return formatter.format(weeklyMin);
  }
  return `${formatter.format(weeklyMin)} – ${formatter.format(weeklyMax)}`;
}

export function formatRentCalloutSubline(compCount: number | null | undefined) {
  if (compCount != null && compCount > 0) {
    return `Based on ${compCount} similar ${compCount === 1 ? "property" : "properties"} currently for lease nearby. This is a guide only — not a valuation or rent guarantee.`;
  }
  return "Indicative guide only — not a valuation or rent guarantee.";
}

export function rentCalloutFromReport(ltr: {
  weekly_min: number | null;
  weekly_max: number | null;
  weekly_midpoint?: number | null;
}) {
  const min = ltr.weekly_min;
  const max = ltr.weekly_max;
  if (min == null || max == null) {
    if (ltr.weekly_midpoint != null) {
      return formatWeeklyRentRange(ltr.weekly_midpoint, ltr.weekly_midpoint).replace(
        /\s*per week\s*$/i,
        "",
      );
    }
    return null;
  }
  return formatRentCalloutAmount(min, max);
}
