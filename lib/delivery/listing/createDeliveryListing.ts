import { createAdminClient } from "@/lib/supabase/admin";
import { buildListingInsertFromParsed } from "@/lib/delivery/str/buildListingFromScrape";
import { generateListingSlug } from "@/lib/listings/provisionLandingPage";
import type { Agency, Listing, ParsedListing } from "@/lib/types";

export async function createDeliveryListingFromParsed({
  agency,
  listingUrl,
  parsed,
}: {
  agency: Agency;
  listingUrl: string;
  parsed: ParsedListing;
}): Promise<Listing> {
  const admin = createAdminClient();
  const listingFields = buildListingInsertFromParsed(listingUrl, parsed);

  const { data: createdListing, error: listingError } = await admin
    .from("listings")
    .insert({
      agency_id: agency.id,
      status: "active",
      public_slug: generateListingSlug(),
      ...listingFields,
      scraped_listing_json: parsed,
    })
    .select("*")
    .single();

  if (listingError || !createdListing) {
    throw new Error(listingError?.message ?? "Failed to create listing");
  }

  return createdListing as Listing;
}

export async function updateDeliveryListingScrapedJson(
  listingId: string,
  parsed: ParsedListing,
) {
  const admin = createAdminClient();
  const listingFields = buildListingInsertFromParsed("", parsed);

  const { error } = await admin
    .from("listings")
    .update({
      scraped_listing_json: parsed,
      listing_description: listingFields.listing_description,
      listing_title: listingFields.listing_title,
      display_price: listingFields.display_price,
      bedrooms: listingFields.bedrooms,
      bathrooms: listingFields.bathrooms,
      car_spaces: listingFields.car_spaces,
      property_type: listingFields.property_type,
    })
    .eq("id", listingId);

  if (error) {
    throw new Error(error.message);
  }
}
