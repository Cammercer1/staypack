import { z } from "zod";
import type { StrMarketOccupancy } from "@/lib/types";

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const occupancyProfileSchema = z.object({
  basis: z.literal("historical_market"),
  label: z.string(),
  allPropertyTypes: z.boolean(),
  months: z.array(z.object({ month: monthKey, average: z.number().finite().min(0).max(100).nullable() })).length(12),
});
export type OccupancyProfile = z.infer<typeof occupancyProfileSchema>;

/** Use saved market history only. Modelled revenue seasonality is not an occupancy forecast. */
export function occupancyProfileFromReport(history: StrMarketOccupancy | undefined): OccupancyProfile | null {
  if (history?.status !== "available" || !history.months.length) return null;
  const rates = new Map<string, number>();
  for (const row of history.months) {
    if (!monthKey.safeParse(row.month).success || !Number.isFinite(row.average) || row.average < 0 || row.average > 100 || rates.has(row.month)) return null;
    rates.set(row.month, row.average);
  }
  const latest = [...rates.keys()].sort().at(-1)!;
  const [year, month] = latest.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = new Date(Date.UTC(year, month - 12 + index, 1)).toISOString().slice(0, 7);
    return { month: key, average: rates.get(key) ?? null };
  });
  return occupancyProfileSchema.parse({ basis: "historical_market", label: history.label,
    allPropertyTypes: history.benchmark_scope === "all_property_types", months });
}

export { occupancyMonthLabel } from "./forecastPresentation";

/** Freeze a public-safe explanation on new snapshots; never expose provider diagnostics. */
export function occupancyUnavailableMessage(history: StrMarketOccupancy | undefined) {
  if (occupancyProfileFromReport(history)) return undefined;
  if (history?.unavailable_reason === "insufficient_data") {
    const locality = history.market?.locality;
    return `Monthly occupancy history is unavailable${locality ? ` for ${locality}` : " for this market"} with this bedroom count. There is not enough matching market data to show a reliable chart.`;
  }
  return "Monthly occupancy history could not be retrieved for this proposal. No occupancy chart has been estimated or substituted.";
}
