import { MIN_RENT_COMPS_FOR_BAND } from "@/lib/rental/rentCompThresholds";
import {
  matchesSaleSubjectPropertyType,
} from "@/lib/sales/rankSaleCompsForSubject";
import type { SaleComp } from "@/lib/sales/types";

export type SalePriceBandResult = {
  priceMin: number;
  priceMax: number;
  priceMidpoint: number;
  compCount: number;
};

export type SalePriceBandOptions = {
  subjectPropertyType?: string;
  preferSuburb?: string;
  subjectBedrooms?: number;
  subjectBathrooms?: number;
  /** Lower percentile for band min (default 0.35). */
  percentileLow?: number;
  /** Upper percentile for band max (default 0.65). */
  percentileHigh?: number;
  /** Drop comps beyond this fraction from median price when enough remain (default 0.3). */
  medianDeviationPct?: number;
};

/** Minimum sold comps required to compute a sale price band. */
export const MIN_SALE_COMPS_FOR_BAND = MIN_RENT_COMPS_FOR_BAND;

function percentile(sorted: number[], p: number) {
  if (!sorted.length) {
    return 0;
  }
  const index = Math.floor((sorted.length - 1) * p);
  return sorted[index] ?? sorted[0]!;
}

export function roundSalePrice(value: number) {
  return Math.round(value / 5000) * 5000;
}

export function formatSalePriceRange(min: number, max: number) {
  const formatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
  const low = formatter.format(min);
  const high = formatter.format(max);
  if (min === max) {
    return low;
  }
  return `${low} – ${high}`;
}

function applyFilterIfEnough(
  comps: SaleComp[],
  predicate: (comp: SaleComp) => boolean,
  minKeep = MIN_SALE_COMPS_FOR_BAND,
): SaleComp[] {
  const next = comps.filter(predicate);
  return next.length >= minKeep ? next : comps;
}

function withinTolerance(actual?: number, target?: number, tolerance = 1) {
  if (target == null || actual == null) {
    return true;
  }
  return Math.abs(actual - target) <= tolerance;
}

function filterIqrOutliers(
  comps: SaleComp[],
  minKeep = MIN_SALE_COMPS_FOR_BAND,
): SaleComp[] {
  if (comps.length < minKeep + 2) {
    return comps;
  }

  const prices = comps.map((comp) => comp.price).sort((a, b) => a - b);
  const q1 = percentile(prices, 0.25);
  const q3 = percentile(prices, 0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) {
    return comps;
  }

  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const next = comps.filter((comp) => comp.price >= lo && comp.price <= hi);

  return next.length >= minKeep ? next : comps;
}

function filterByMedianProximity(
  comps: SaleComp[],
  deviationPct = 0.3,
  minKeep = MIN_SALE_COMPS_FOR_BAND,
): SaleComp[] {
  if (comps.length < minKeep) {
    return comps;
  }

  const prices = comps.map((comp) => comp.price).sort((a, b) => a - b);
  const median = percentile(prices, 0.5);
  const lo = median * (1 - deviationPct);
  const hi = median * (1 + deviationPct);
  const next = comps.filter((comp) => comp.price >= lo && comp.price <= hi);

  return next.length >= minKeep ? next : comps;
}

/** Prevent absurdly wide bands when REA mixes cheap + trophy stock in one SERP. */
function capSalePriceBandWidth(
  band: SalePriceBandResult,
  maxSpreadPct = 0.15,
): SalePriceBandResult {
  const mid = band.priceMidpoint;
  if (mid <= 0) {
    return band;
  }

  const halfSpread = mid * (maxSpreadPct / 2);
  const cappedMin = roundSalePrice(Math.max(band.priceMin, mid - halfSpread));
  const cappedMax = roundSalePrice(Math.min(band.priceMax, mid + halfSpread));
  const priceMin = Math.min(cappedMin, cappedMax);
  const priceMax = Math.max(cappedMin, cappedMax);

  if (priceMin === band.priceMin && priceMax === band.priceMax) {
    return band;
  }

  return {
    ...band,
    priceMin,
    priceMax,
    priceMidpoint: roundSalePrice((priceMin + priceMax) / 2),
  };
}

export function computeSalePriceBandFromPrices(
  prices: number[],
  options?: SalePriceBandOptions,
): SalePriceBandResult | null {
  const sorted = prices
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (sorted.length < MIN_SALE_COMPS_FOR_BAND) {
    return null;
  }

  const trimmed = sorted.filter((price) => {
    const lo = percentile(sorted, 0.15);
    const hi = percentile(sorted, 0.85);
    return price >= lo && price <= hi;
  });

  const pool = trimmed.length >= MIN_SALE_COMPS_FOR_BAND ? trimmed : sorted;
  const pLow = options?.percentileLow ?? 0.35;
  const pHigh = options?.percentileHigh ?? 0.65;

  return {
    priceMin: roundSalePrice(percentile(pool, pLow)),
    priceMax: roundSalePrice(percentile(pool, pHigh)),
    priceMidpoint: roundSalePrice(percentile(pool, 0.5)),
    compCount: pool.length,
  };
}

/**
 * Estimated sale price band from **sold** comps (percentiles + IQR outlier
 * removal, adapted from the weekly rent band). For-sale price guides are
 * display-only context and must not be passed in.
 */
export function computeSalePriceBandFromComps(
  soldComps: SaleComp[],
  options?: SalePriceBandOptions,
): SalePriceBandResult | null {
  let filtered = soldComps.filter((comp) => comp.price > 0);

  if (options?.subjectPropertyType) {
    filtered = applyFilterIfEnough(filtered, (comp) =>
      matchesSaleSubjectPropertyType(comp, options.subjectPropertyType),
    );
  }

  if (options?.preferSuburb?.trim()) {
    const preferSuburb = options.preferSuburb.trim().toLowerCase();
    filtered = applyFilterIfEnough(
      filtered,
      (comp) => comp.suburb?.trim().toLowerCase() === preferSuburb,
    );
  }

  if (options?.subjectBedrooms != null) {
    filtered = applyFilterIfEnough(
      filtered,
      (comp) => comp.bedrooms === options.subjectBedrooms,
    );
    filtered = applyFilterIfEnough(filtered, (comp) =>
      withinTolerance(comp.bedrooms, options.subjectBedrooms, 1),
    );
  }

  if (options?.subjectBathrooms != null) {
    filtered = applyFilterIfEnough(filtered, (comp) =>
      withinTolerance(comp.bathrooms, options.subjectBathrooms, 1),
    );
  }

  filtered = filterIqrOutliers(filtered);
  filtered = filterByMedianProximity(
    filtered,
    options?.medianDeviationPct ?? 0.3,
  );

  const band = computeSalePriceBandFromPrices(
    filtered.map((comp) => comp.price),
    options,
  );

  if (!band) {
    return null;
  }

  return capSalePriceBandWidth(band);
}
