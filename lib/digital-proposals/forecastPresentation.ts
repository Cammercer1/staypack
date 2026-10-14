import type { ProposalData } from "./data";

export const CALENDAR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Allocate whole-dollar estimates without making the rounded months drift from the annual total. */
function allocateAnnual(annual: number | null, weights: number[]): (number | null)[] {
  if (annual === null) return weights.map(() => null);
  const target = Math.round(annual);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map(weight => target * weight / totalWeight);
  const values = exact.map(Math.floor);
  const remainder = target - values.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - values[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order.slice(0, remainder)) values[index] += 1;
  return values;
}

export function monthlyRevenueProjection(data: ProposalData) {
  if (!data.seasonality) return null;
  const ltr = allocateAnnual(data.ltr.annualRent, Array(12).fill(1));
  const market = allocateAnnual(data.str.market.annualRevenue, data.seasonality.weights);
  const managed = allocateAnnual(data.str.managed.annualRevenue, data.seasonality.weights);
  return CALENDAR_MONTHS.map((month, index) => ({ month, ltr: ltr[index], market: market[index], managed: managed[index] }));
}

export function occupancyMonthLabel(month: string) {
  return `${CALENDAR_MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}
