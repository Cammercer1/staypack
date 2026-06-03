import { mergeScrapeMasterSelection } from "@/lib/listings/collateralImages";
import { detectListingPurpose } from "@/lib/listings/detectListingPurpose";
import { listingImageMetaForScrapeUpdate } from "@/lib/listings/syncListingImageMeta";
import type { Listing, ParsedListing } from "@/lib/types";

export function buildListingInsertFromParsed(
  listingUrl: string,
  parsed: ParsedListing,
) {
  const master = mergeScrapeMasterSelection(
    {
      scraped_listing_json: parsed,
      uploaded_image_urls: [],
    },
    null,
  );

  return {
    listing_url: listingUrl,
    listing_purpose: detectListingPurpose({
      url: listingUrl,
      displayPrice: parsed.displayPrice,
      aiPurpose: parsed.purpose ?? null,
    }),
    property_address: parsed.address ?? null,
    suburb: parsed.suburb ?? null,
    state: parsed.state ?? null,
    postcode: parsed.postcode ?? null,
    property_type: parsed.propertyType ?? null,
    bedrooms: parsed.bedrooms ?? null,
    bathrooms: parsed.bathrooms ?? null,
    car_spaces: parsed.carSpaces ?? null,
    listing_title: parsed.title ?? null,
    listing_description: parsed.description ?? null,
    display_price: parsed.displayPrice ?? null,
    hero_image_url: master.hero_image_url,
    selected_image_urls: master.selected_image_urls,
    scraped_listing_json: parsed,
    listing_image_meta: listingImageMetaForScrapeUpdate(
      {
        scraped_listing_json: parsed,
        uploaded_image_urls: [],
        listing_image_meta: {},
      },
      parsed.images,
    ),
  };
}

export function assertListingReadyForStr(listing: Pick<Listing, "selected_image_urls">) {
  const count = listing.selected_image_urls?.length ?? 0;
  if (count < 5) {
    throw new Error(
      `Listing needs at least 5 photos for STR collateral (found ${count})`,
    );
  }
}
