import type { CollateralType, Listing } from "@/lib/types";
import {
  dedupeImageUrls,
  imageDedupeKey,
} from "@/lib/listings/dedupeImageUrls";
import {
  MAX_BROCHURE_IMAGES,
  MAX_BUSINESS_CARD_IMAGES,
  MAX_LANDING_IMAGES,
  MAX_SNAPSHOT_IMAGES,
} from "@/lib/listings/collateralImageLimits";
import { MAX_REPORT_IMAGES } from "@/lib/reports/constants";

export type CollateralImageChannel = "landing" | CollateralType;

export type CollateralImageSelection = {
  hero_image_url: string | null;
  selected_image_urls: string[];
};

const CHANNEL_LIMITS: Record<CollateralImageChannel, number> = {
  landing: MAX_LANDING_IMAGES,
  str_report: MAX_REPORT_IMAGES,
  lease_appraisal: MAX_REPORT_IMAGES,
  sales_appraisal: MAX_REPORT_IMAGES,
  sales_brochure: MAX_BROCHURE_IMAGES,
  rental_brochure: MAX_BROCHURE_IMAGES,
  social_posts: MAX_SNAPSHOT_IMAGES,
  investor_snapshot: MAX_SNAPSHOT_IMAGES,
  agent_business_card: MAX_BUSINESS_CARD_IMAGES,
};

export function getChannelImageLimit(channel: CollateralImageChannel) {
  return CHANNEL_LIMITS[channel];
}

/** Scraped images (visually deduped) first, then uploads. */
export function getListingImagePool(
  listing: Pick<Listing, "scraped_listing_json" | "uploaded_image_urls">,
) {
  const pool = dedupeImageUrls(listing.scraped_listing_json?.images ?? []);
  const seen = new Set(pool.map((url) => imageDedupeKey(url)));

  for (const url of listing.uploaded_image_urls ?? []) {
    const trimmed = url.trim();
    if (!trimmed) continue;

    const key = imageDedupeKey(trimmed);
    if (seen.has(key)) continue;

    seen.add(key);
    pool.push(trimmed);
  }

  return pool;
}

export function getDedupedScrapedImages(
  listing: Pick<Listing, "scraped_listing_json">,
) {
  return dedupeImageUrls(listing.scraped_listing_json?.images ?? []);
}

export function normalizeSelectionToPool(
  selection: CollateralImageSelection,
  pool: string[],
): CollateralImageSelection {
  const canonicalByKey = new Map(pool.map((url) => [imageDedupeKey(url), url]));
  const selected: string[] = [];

  for (const url of selection.selected_image_urls) {
    const canonical = canonicalByKey.get(imageDedupeKey(url)) ?? url;
    if (pool.includes(canonical) && !selected.includes(canonical)) {
      selected.push(canonical);
    }
  }

  const heroCandidate = selection.hero_image_url
    ? canonicalByKey.get(imageDedupeKey(selection.hero_image_url)) ??
      selection.hero_image_url
    : null;
  const hero =
    heroCandidate && selected.includes(heroCandidate)
      ? heroCandidate
      : selected[0] ?? null;

  return {
    hero_image_url: hero,
    selected_image_urls: selected,
  };
}

/** Add any pool photos missing from the selection (e.g. after upload). */
export function mergeNewPhotosIntoSelection(
  selection: CollateralImageSelection,
  pool: string[],
): CollateralImageSelection {
  const selected = [...selection.selected_image_urls];

  for (const url of pool) {
    if (!selected.includes(url)) {
      selected.push(url);
    }
  }

  return normalizeSelectionToPool(
    {
      hero_image_url: selection.hero_image_url,
      selected_image_urls: selected,
    },
    pool,
  );
}

function normalizeSelection(selection: CollateralImageSelection) {
  const selected = selection.selected_image_urls ?? [];
  const hero = selection.hero_image_url ?? selected[0] ?? null;

  return {
    hero_image_url: hero,
    selected_image_urls: selected.length ? selected : hero ? [hero] : [],
  };
}

/** Default: all unique photos in import order (capped at 25). */
export function buildDefaultMasterSelection(
  listing: Pick<Listing, "scraped_listing_json" | "uploaded_image_urls">,
): CollateralImageSelection {
  const pool = getListingImagePool(listing);
  const selected = pool.slice(0, MAX_LANDING_IMAGES);

  return {
    hero_image_url: selected[0] ?? null,
    selected_image_urls: selected,
  };
}

/** User's curated set — defaults to all photos when nothing saved yet. */
export function resolveMasterPhotoSelection(listing: Listing): CollateralImageSelection {
  const pool = getListingImagePool(listing);

  if (listing.selected_image_urls?.length || listing.hero_image_url) {
    return normalizeSelectionToPool(
      normalizeSelection({
        hero_image_url: listing.hero_image_url,
        selected_image_urls: listing.selected_image_urls ?? [],
      }),
      pool,
    );
  }

  return buildDefaultMasterSelection(listing);
}

/** On re-scrape: keep the user's picks that still exist, otherwise select all. */
export function mergeScrapeMasterSelection(
  listing: Pick<Listing, "scraped_listing_json" | "uploaded_image_urls">,
  existing?: Pick<Listing, "hero_image_url" | "selected_image_urls"> | null,
): CollateralImageSelection {
  const pool = getListingImagePool(listing);
  const defaults = buildDefaultMasterSelection(listing);

  if (!existing?.selected_image_urls?.length && !existing?.hero_image_url) {
    return defaults;
  }

  const normalized = normalizeSelectionToPool(
    normalizeSelection({
      hero_image_url: existing.hero_image_url,
      selected_image_urls: existing.selected_image_urls ?? [],
    }),
    pool,
  );

  if (normalized.selected_image_urls.length) {
    return normalized;
  }

  return defaults;
}

/** Each collateral type takes the first N photos from the master selection. */
export function resolveCollateralImageSelection(
  listing: Listing,
  channel: CollateralImageChannel,
): CollateralImageSelection {
  const master = resolveMasterPhotoSelection(listing);
  const limit = getChannelImageLimit(channel);
  const selected = master.selected_image_urls.slice(0, limit);
  const hero =
    master.hero_image_url && selected.includes(master.hero_image_url)
      ? master.hero_image_url
      : selected[0] ?? null;

  return {
    hero_image_url: hero,
    selected_image_urls: selected,
  };
}

export function resolveCollateralGalleryUrls(
  listing: Listing,
  channel: CollateralImageChannel,
) {
  const { hero_image_url, selected_image_urls } = resolveCollateralImageSelection(
    listing,
    channel,
  );

  const urls: string[] = [];
  if (hero_image_url) urls.push(hero_image_url);

  for (const url of selected_image_urls) {
    if (url && !urls.includes(url)) urls.push(url);
  }

  return urls;
}

export function getMasterSelectionLimit(
  listing: Pick<Listing, "scraped_listing_json" | "uploaded_image_urls">,
) {
  return Math.min(getListingImagePool(listing).length, MAX_LANDING_IMAGES);
}
