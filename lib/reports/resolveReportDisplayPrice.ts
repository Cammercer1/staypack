import { extractPropertyPriceAmounts, normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import type { Listing, ParsedListing } from "@/lib/types";

type ListingPriceSource = Pick<Listing, "display_price" | "scraped_listing_json">;

function pickParseablePrice(raw: string | null | undefined) {
  if (!raw?.trim()) {
    return null;
  }

  const candidates = [normalizeDisplayPrice(raw), raw.trim()];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (extractPropertyPriceAmounts(candidate).length > 0) {
      return candidate;
    }
  }

  return null;
}

export function resolveReportDisplayPrice(
  listing: ListingPriceSource,
  scraped?: ParsedListing | null,
): string | null {
  const scrapedListing = scraped ?? listing.scraped_listing_json;

  for (const candidate of [listing.display_price, scrapedListing?.displayPrice]) {
    const parsed = pickParseablePrice(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
