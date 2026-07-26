import type { SaleComp } from "@/lib/sales/types";

export const MAX_SOLD_COMP_AGE_MONTHS = 12;
export const MAX_DOMAIN_AVM_SOLD_COMP_AGE_MONTHS = 18;

function soldDateTimestamp(value?: string) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function soldCompCutoff(
  referenceDate = new Date(),
  maxAgeMonths = MAX_SOLD_COMP_AGE_MONTHS,
) {
  const cutoff = new Date(referenceDate);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - maxAgeMonths);
  return cutoff;
}

/**
 * Sold evidence must have a verifiable recent date. REA uses 12 months;
 * Domain's exact-address AVM-selected evidence may extend to 18 months.
 */
export function isRecentSoldComp(
  comp: SaleComp,
  referenceDate = new Date(),
) {
  if (comp.saleStatus !== "sold") return true;

  const timestamp = soldDateTimestamp(comp.soldDate);
  if (timestamp == null) return false;
  const maxAgeMonths =
    comp.provider === "domain_avm"
      ? MAX_DOMAIN_AVM_SOLD_COMP_AGE_MONTHS
      : MAX_SOLD_COMP_AGE_MONTHS;

  return (
    timestamp >= soldCompCutoff(referenceDate, maxAgeMonths).getTime() &&
    timestamp <= referenceDate.getTime()
  );
}

export function filterRecentSaleComps(
  comps: SaleComp[],
  referenceDate = new Date(),
) {
  return comps.filter((comp) => isRecentSoldComp(comp, referenceDate));
}
