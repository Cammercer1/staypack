import { getListingImagePool } from "@/lib/listings/collateralImages";
import {
  mergeGuessedListingImageMeta,
  normalizeListingImageMetaMap,
  normalizeListingImageMetaMapKeys,
  pruneListingImageMetaToPool,
} from "@/lib/listings/listingImageMeta";
import type { Listing, ListingImageMetaMap } from "@/lib/types";

export function resolveListingImageMetaForPool(
  listing: Pick<
    Listing,
    "scraped_listing_json" | "uploaded_image_urls" | "listing_image_meta"
  >,
): ListingImageMetaMap {
  const pool = getListingImagePool(listing);
  const merged = mergeGuessedListingImageMeta(
    listing.listing_image_meta ?? {},
    pool,
  );
  const pruned = pruneListingImageMetaToPool(merged, pool);
  return normalizeListingImageMetaMapKeys(pruned);
}

export function listingImageMetaForScrapeUpdate(
  existing: Pick<
    Listing,
    "scraped_listing_json" | "uploaded_image_urls" | "listing_image_meta"
  >,
  scrapedImages: string[],
): ListingImageMetaMap {
  const pool = [
    ...scrapedImages,
    ...(existing.uploaded_image_urls ?? []),
  ];
  const merged = mergeGuessedListingImageMeta(
    existing.listing_image_meta ?? {},
    pool,
  );
  return normalizeListingImageMetaMapKeys(pruneListingImageMetaToPool(merged, pool));
}

export function normalizeListingImageMetaInput(
  raw: ListingImageMetaMap | null | undefined,
): ListingImageMetaMap {
  return normalizeListingImageMetaMapKeys(normalizeListingImageMetaMap(raw));
}
