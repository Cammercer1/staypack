import { formatCurrency } from "@/lib/reports/formatters";

const PRICE_LABEL_PREFIX =
  /^(?:display\s+)?(?:listing\s+)?price(?:\s*range)?\s*:?\s*/i;

const NON_NUMERIC_PRICE =
  /^(?:contact|call|enquir|auction|eoi|express(?:ions?)?\s+of\s+interest|poa|price\s+on\s+(?:application|request)|tender|sold|under\s+contract|by\s+negotiation|negotiable)\b/i;

const SINGLE_QUALIFIER =
  /^(offers?\s+over|over|from|guide(?:\s+price)?|around|circa|asking|starting\s+from)\b/i;

const RANGE_SPLIT = /\s+(?:to|and|–|-|—)\s+|\s*[-–—]\s*/i;

function parseAmountFragment(fragment: string): number | null {
  const cleaned = fragment.replace(/[$,\s]/g, "").trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(million|mil|m|k|thousand)?$/i);
  if (!match) {
    return null;
  }

  let value = Number(match[1]);
  const suffix = (match[2] ?? "").toLowerCase();

  if (suffix.startsWith("m")) {
    value *= 1_000_000;
  } else if (suffix === "k" || suffix === "thousand") {
    value *= 1_000;
  }

  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractAmounts(text: string): number[] {
  const amounts: number[] = [];

  for (const match of text.matchAll(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(million|mil|m|k|thousand)?/gi,
  )) {
    const parsed = parseAmountFragment(`${match[1]}${match[2] ?? ""}`);
    if (parsed != null) {
      amounts.push(parsed);
    }
  }

  if (!amounts.length) {
    for (const match of text.matchAll(/(?:^|[^\d.])(\d{6,})(?:[^\d.]|$)/g)) {
      const parsed = parseAmountFragment(match[1]);
      if (parsed != null) {
        amounts.push(parsed);
      }
    }
  }

  return [...new Set(amounts)];
}

function extractSingleQualifier(text: string): string | null {
  const stripped = text.replace(PRICE_LABEL_PREFIX, "").trim();
  const match = stripped.match(SINGLE_QUALIFIER);
  return match ? match[1] : null;
}

function formatRange(min: number, max: number) {
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

function titleCasePhrase(text: string) {
  return text
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const QUALIFIER_LABELS: Record<string, string> = {
  "offers over": "Offers over",
  "offer over": "Offers over",
  over: "Over",
  from: "From",
  "guide price": "Guide",
  guide: "Guide",
  around: "Around",
  circa: "Circa",
  asking: "Asking",
  "starting from": "Starting from",
};

function formatQualifier(raw: string) {
  return QUALIFIER_LABELS[raw.trim().toLowerCase()] ?? raw.trim();
}

/**
 * Turns noisy scraped price strings into concise display text.
 * e.g. "Price Range $2,300,000 to $2,500,000" → "$2,300,000 – $2,500,000"
 */
export function normalizeDisplayPrice(
  raw: string | null | undefined,
): string | undefined {
  if (!raw?.trim()) {
    return undefined;
  }

  const text = raw.replace(/\s+/g, " ").trim();
  const withoutLabel = text.replace(PRICE_LABEL_PREFIX, "").trim();

  if (NON_NUMERIC_PRICE.test(withoutLabel) && !/\$\s*\d/.test(withoutLabel)) {
    return titleCasePhrase(withoutLabel);
  }

  const amounts = extractAmounts(withoutLabel);

  if (amounts.length >= 2) {
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (min === max) {
      return formatCurrency(min);
    }
    return formatRange(min, max);
  }

  if (amounts.length === 1) {
    const qualifier = extractSingleQualifier(withoutLabel);
    const formatted = formatCurrency(amounts[0]);
    return qualifier ? `${formatQualifier(qualifier)} ${formatted}` : formatted;
  }

  const rangeParts = withoutLabel.split(RANGE_SPLIT).map((part) => part.trim());
  if (rangeParts.length === 2) {
    const low = parseAmountFragment(rangeParts[0]);
    const high = parseAmountFragment(rangeParts[1]);
    if (low != null && high != null) {
      return low === high ? formatCurrency(low) : formatRange(low, high);
    }
  }

  const cleaned = withoutLabel.replace(PRICE_LABEL_PREFIX, "").trim();
  return cleaned || undefined;
}
