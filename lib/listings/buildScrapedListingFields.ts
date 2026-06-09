import { mergeScrapeMasterSelection } from "@/lib/listings/collateralImages";
import { detectListingPurpose } from "@/lib/listings/detectListingPurpose";
import { listingImageMetaForScrapeUpdate } from "@/lib/listings/syncListingImageMeta";
import type { Listing, ParsedListing } from "@/lib/types";

export function buildScrapedListingFields(
  listingUrl: string,
  listing: ParsedListing,
  existing?: Partial<Listing>,
) {
  const master = mergeScrapeMasterSelection(
    {
      scraped_listing_json: listing,
      uploaded_image_urls: existing?.uploaded_image_urls ?? [],
    },
    existing
      ? {
          hero_image_url: existing.hero_image_url ?? null,
          selected_image_urls: existing.selected_image_urls ?? [],
        }
      : null,
  );

  return {
    listing_url: listingUrl,
    listing_purpose:
      existing?.listing_purpose ??
      detectListingPurpose({
        url: listingUrl,
        displayPrice: listing.displayPrice,
        aiPurpose: listing.purpose ?? null,
      }),
    property_address: listing.address ?? existing?.property_address ?? null,
    suburb: listing.suburb ?? existing?.suburb ?? null,
    state: listing.state ?? existing?.state ?? null,
    postcode: listing.postcode ?? existing?.postcode ?? null,
    property_type: listing.propertyType ?? existing?.property_type ?? null,
    bedrooms: listing.bedrooms ?? existing?.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? existing?.bathrooms ?? null,
    car_spaces: listing.carSpaces ?? existing?.car_spaces ?? null,
    listing_title: listing.title ?? existing?.listing_title ?? null,
    listing_description: listing.description ?? existing?.listing_description ?? null,
    display_price: listing.displayPrice ?? existing?.display_price ?? null,
    hero_image_url: master.hero_image_url,
    selected_image_urls: master.selected_image_urls,
    scraped_listing_json: listing,
    listing_image_meta: listingImageMetaForScrapeUpdate(
      {
        scraped_listing_json: listing,
        uploaded_image_urls: existing?.uploaded_image_urls ?? [],
        listing_image_meta: existing?.listing_image_meta ?? {},
      },
      listing.images,
    ),
  };
}
