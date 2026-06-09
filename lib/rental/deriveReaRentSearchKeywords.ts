import type { ListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import type { ParsedListing } from "@/lib/types";

/** REA `keywords` values that correlate with premium stock (keep list short — AND narrows fast). */
const AMENITY_KEYWORD_PATTERNS: { pattern: RegExp; keyword: string }[] = [
  { pattern: /\b(?:swimming\s+)?pool\b/i, keyword: "pool" },
  { pattern: /\bwater\s+view/i, keyword: "water views" },
  { pattern: /\bocean\s+view/i, keyword: "ocean views" },
  { pattern: /\briver\s+view/i, keyword: "river views" },
  { pattern: /\bcity\s+view/i, keyword: "city views" },
  { pattern: /\b(?:ensuite|en-suite)\b/i, keyword: "ensuite" },
  { pattern: /\bair\s*[- ]?con/i, keyword: "air conditioning" },
  { pattern: /\bbalcony\b/i, keyword: "balcony" },
  { pattern: /\b(?:lift|elevator)\b/i, keyword: "lift" },
  { pattern: /\bpenthouse\b/i, keyword: "penthouse" },
  { pattern: /\b(?:waterfront|beachfront)\b/i, keyword: "waterfront" },
  { pattern: /\b(?:gym|fitness)\b/i, keyword: "gym" },
  { pattern: /\b(?:concierge|doorman)\b/i, keyword: "concierge" },
];

const MAX_REA_KEYWORDS = 3;
/** Primary luxury SERP — one keyword matches REA UX and returns enough comps. */
const LUXURY_PRIMARY_KEYWORD = "luxury";

function listingText(listing: ParsedListing) {
  return [listing.title, listing.description].filter(Boolean).join("\n");
}

function amenityKeywordsFromText(text: string): string[] {
  const found: string[] = [];
  for (const { pattern, keyword } of AMENITY_KEYWORD_PATTERNS) {
    if (pattern.test(text) && !found.includes(keyword)) {
      found.push(keyword);
    }
  }
  return found;
}

/**
 * Keywords for REA rent SERP refinement.
 * Primary luxury search uses `luxury` only; amenities are for widened attempts.
 */
export function deriveReaRentSearchKeywords(
  listing: ParsedListing,
  premiumSignals: ListingPremiumSignals,
  options?: { primaryLuxuryOnly?: boolean },
): string[] {
  const text = listingText(listing);
  const keywords: string[] = [];

  if (premiumSignals.luxuryScore >= 1 || /\bluxury\b/i.test(text)) {
    keywords.push(LUXURY_PRIMARY_KEYWORD);
  } else if (/\b(?:prestige|executive|premium)\b/i.test(text)) {
    keywords.push("prestige");
  }

  if (options?.primaryLuxuryOnly && keywords.length > 0) {
    return keywords.slice(0, 1);
  }

  for (const amenity of amenityKeywordsFromText(text)) {
    if (keywords.length >= MAX_REA_KEYWORDS) {
      break;
    }
    if (!keywords.includes(amenity)) {
      keywords.push(amenity);
    }
  }

  return keywords.slice(0, MAX_REA_KEYWORDS);
}

export function shouldUseLuxuryRentSearch(
  listing: ParsedListing,
  premiumSignals: ListingPremiumSignals,
): boolean {
  if (premiumSignals.luxuryScore >= 1) {
    return true;
  }
  const text = listingText(listing).toLowerCase();
  return /\b(luxury|prestige|executive|penthouse|waterfront)\b/.test(text);
}
