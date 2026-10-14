import { z } from "zod";
import type { StrEnrichmentJson } from "@/lib/types";

import { CALENDAR_MONTHS } from "./forecastPresentation";
export { CALENDAR_MONTHS, monthlyRevenueProjection } from "./forecastPresentation";
export const seasonalProfileSchema = z.object({
  basis: z.literal("seasonal_projection"),
  weights: z.array(z.number().finite().nonnegative().max(1)).length(12)
    .refine(weights => Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 0.000001),
});

/** Only a complete calendar profile can support a 12-month projection. */
export function seasonalProfileFromReport(rows: StrEnrichmentJson["seasonality"] | undefined) {
  if (!rows || rows.length !== 12) return null;
  const revenues = new Map<number, number>();
  for (const row of rows) {
    const label = row.month.trim();
    const month = /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(label)
      ? Number(label.slice(5, 7)) - 1 : CALENDAR_MONTHS.findIndex(value => value.toLowerCase() === label.toLowerCase());
    if (month < 0 || revenues.has(month) || row.revenue === null || !Number.isFinite(row.revenue) || row.revenue < 0) return null;
    revenues.set(month, row.revenue);
  }
  const total = [...revenues.values()].reduce((sum, revenue) => sum + revenue, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return seasonalProfileSchema.parse({ basis: "seasonal_projection", weights: CALENDAR_MONTHS.map((_, month) => revenues.get(month)! / total) });
}
