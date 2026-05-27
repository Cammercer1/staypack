import { extractPropertyPriceAmounts } from "@/lib/scraping/normalizeDisplayPrice";

export type StrGrossYield = {
  display_price: string;
  price_min: number;
  price_max: number;
  price_midpoint: number;
  yield_min_percent: number;
  yield_max_percent: number;
  yield_midpoint_percent: number;
};

function roundYieldPercent(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateStrGrossYield(
  displayPrice: string | null | undefined,
  annualRevenue: number | null | undefined,
): StrGrossYield | null {
  if (!displayPrice?.trim() || annualRevenue == null || annualRevenue <= 0) {
    return null;
  }

  const amounts = extractPropertyPriceAmounts(displayPrice);

  if (!amounts.length) {
    return null;
  }

  const priceMin = Math.min(...amounts);
  const priceMax = Math.max(...amounts);
  const priceMidpoint = (priceMin + priceMax) / 2;

  return {
    display_price: displayPrice.trim(),
    price_min: priceMin,
    price_max: priceMax,
    price_midpoint: priceMidpoint,
    yield_min_percent: roundYieldPercent((annualRevenue / priceMax) * 100),
    yield_max_percent: roundYieldPercent((annualRevenue / priceMin) * 100),
    yield_midpoint_percent: roundYieldPercent((annualRevenue / priceMidpoint) * 100),
  };
}

export function resolveStrGrossYield(input: {
  display_price?: string | null;
  annual_revenue?: number | null;
  str_yield?: StrGrossYield | null;
}): StrGrossYield | null {
  if (input.str_yield) {
    return input.str_yield;
  }

  return calculateStrGrossYield(input.display_price, input.annual_revenue);
}

export function formatStrGrossYield(value: StrGrossYield) {
  if (value.price_min === value.price_max) {
    return `${value.yield_midpoint_percent.toFixed(1)}%`;
  }

  const low = Math.min(value.yield_min_percent, value.yield_max_percent);
  const high = Math.max(value.yield_min_percent, value.yield_max_percent);

  return `${low.toFixed(1)}% – ${high.toFixed(1)}%`;
}
