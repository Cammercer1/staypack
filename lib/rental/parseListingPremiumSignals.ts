import type { ParsedListing } from "@/lib/types";

/** Phrases that suggest a premium / luxury rental (case-insensitive). */
export const LUXURY_RENT_KEYWORDS = [
  "luxury",
  "premium",
  "prestige",
  "executive",
  "gated",
  "secure gated",
  "resort-style",
  "resort style",
  "architect",
  "architecturally",
  "designer",
  "custom joinery",
  "wine cellar",
  "home cinema",
  "cinema room",
  "infinity pool",
  "heated pool",
  "city views",
  "river views",
  "panoramic",
  "v-zug",
  "miele",
  "sub-zero",
  "marble",
  "butler",
  "guest wing",
  "master wing",
  "tennis court",
  "elevator",
  "private lift",
  "sauna",
  "steam room",
  "grand entrance",
  "no expense spared",
  "world class",
  "world-class",
] as const;

const LAND_AREA_PATTERNS = [
  /([\d,]+(?:\.\d+)?)\s*(?:sqm|sq\s*m|m²|m2)\b/gi,
  /([\d,]+(?:\.\d+)?)\s*square\s*met(?:re|er)s?\b/gi,
  /([\d,]+(?:\.\d+)?)\s*(?:sqm|sq\s*m|m²|m2)\s*allotment/gi,
];

export const LARGE_LAND_SQM = 600;
export const PREMIUM_LAND_SQM = 800;

export type ListingPremiumSignals = {
  landAreaSqm?: number;
  luxuryKeywordHits: string[];
  luxuryScore: number;
  largeLand: boolean;
  premiumLand: boolean;
};

function listingText(listing: ParsedListing) {
  return [listing.title, listing.description].filter(Boolean).join("\n");
}

export function parseLandAreaSqm(text: string): number | undefined {
  const candidates: number[] = [];

  for (const pattern of LAND_AREA_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1]?.replace(/,/g, "");
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 150 && value <= 50_000) {
        candidates.push(value);
      }
    }
  }

  if (!candidates.length) {
    return undefined;
  }

  return Math.max(...candidates);
}

export function detectLuxuryKeywords(text: string): string[] {
  const normalized = text.toLowerCase();
  return LUXURY_RENT_KEYWORDS.filter((phrase) => normalized.includes(phrase));
}

export function parseListingPremiumSignals(
  listing: ParsedListing,
): ListingPremiumSignals {
  const text = listingText(listing);
  const landAreaSqm = listing.landAreaSqm ?? parseLandAreaSqm(text);
  const luxuryKeywordHits = detectLuxuryKeywords(text);
  const luxuryScore = luxuryKeywordHits.length;

  return {
    landAreaSqm,
    luxuryKeywordHits,
    luxuryScore,
    largeLand: landAreaSqm != null && landAreaSqm >= LARGE_LAND_SQM,
    premiumLand: landAreaSqm != null && landAreaSqm >= PREMIUM_LAND_SQM,
  };
}
