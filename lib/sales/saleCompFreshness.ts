import type { SaleComp } from "@/lib/sales/types";

export const MAX_SOLD_COMP_AGE_MONTHS = 12;

function soldDateTimestamp(value?: string) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function soldCompCutoff(referenceDate = new Date()) {
  const cutoff = new Date(referenceDate);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - MAX_SOLD_COMP_AGE_MONTHS);
  return cutoff;
}

/** Sold evidence must have a verifiable sale date within the preceding 12 months. */
export function isRecentSoldComp(
  comp: SaleComp,
  referenceDate = new Date(),
) {
  if (comp.saleStatus !== "sold") return true;

  const timestamp = soldDateTimestamp(comp.soldDate);
  if (timestamp == null) return false;

  return (
    timestamp >= soldCompCutoff(referenceDate).getTime() &&
    timestamp <= referenceDate.getTime()
  );
}

export function filterRecentSaleComps(
  comps: SaleComp[],
  referenceDate = new Date(),
) {
  return comps.filter((comp) => isRecentSoldComp(comp, referenceDate));
}
