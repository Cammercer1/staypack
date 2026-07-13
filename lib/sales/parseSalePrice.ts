/** Sale prices below this are treated as noise (weekly rents, deposits, typos). */
const MIN_PLAUSIBLE_SALE_PRICE = 50_000;

/**
 * Parse an AUD sale price from an REA display string.
 * Handles "$1,850,000", "$1.2m", "$950,000 - $1,045,000" (midpoint of range),
 * and rejects rent-style strings ("$850 per week") and non-numeric guides
 * ("Auction", "Contact agent").
 */
export function parseSalePriceFromDisplay(display?: string | null): number | null {
  if (!display?.trim()) {
    return null;
  }

  const normalized = display.toLowerCase();
  if (
    normalized.includes("week") ||
    normalized.includes("/wk") ||
    normalized.includes("per annum") ||
    normalized.includes("p.a.")
  ) {
    return null;
  }

  const amounts: number[] = [];
  for (const match of display.matchAll(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(m\b|million)?/gi,
  )) {
    let value = Number.parseFloat(match[1]!.replace(/,/g, ""));
    if (!Number.isFinite(value)) {
      continue;
    }
    if (match[2]) {
      value *= 1_000_000;
    }
    if (value >= MIN_PLAUSIBLE_SALE_PRICE) {
      amounts.push(Math.round(value));
    }
  }

  if (!amounts.length) {
    return null;
  }

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return Math.round((min + max) / 2);
}

/** Accept a structured numeric price when it is plausibly a sale amount. */
export function plausibleSalePrice(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseFloat(value.replace(/[$,]/g, "")) : value;
  if (
    typeof numeric === "number" &&
    Number.isFinite(numeric) &&
    numeric >= MIN_PLAUSIBLE_SALE_PRICE
  ) {
    return Math.round(numeric);
  }
  return null;
}
