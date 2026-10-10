import { extractPropertyPriceAmounts, normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import type { Listing, ParsedListing } from "@/lib/types";

type ListingPriceSource = Pick<Listing, "display_price" | "scraped_listing_json"> & Partial<Pick<Listing, "advertised_sale_price" | "listing_purpose">>;

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
  if (listing.advertised_sale_price !== undefined) return pickParseablePrice(listing.advertised_sale_price);
  if (listing.listing_purpose === "lease") return null;
  const scrapedListing = scraped ?? listing.scraped_listing_json;

  for (const candidate of [listing.display_price, scrapedListing?.displayPrice]) {
    const parsed = pickParseablePrice(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
