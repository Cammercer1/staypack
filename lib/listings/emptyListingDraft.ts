import type { Listing } from "@/lib/types";

export function createEmptyListingDraft(
  overrides: Partial<Listing> = {},
): Listing {
  const now = new Date(0).toISOString();

  return {
    id: "",
    agency_id: "",
    created_by: null,
    agent_profile_id: null,
    status: "active",
    listing_purpose: "sale",
    listing_url: null,
    property_address: null,
    suburb: null,
    state: null,
    postcode: null,
    country: "Australia",
    latitude: null,
    longitude: null,
    property_type: null,
    bedrooms: null,
    bathrooms: null,
    car_spaces: null,
    accommodates: null,
    listing_title: null,
    listing_description: null,
    display_price: null,
    bond: null,
    hero_image_url: null,
    selected_image_urls: null,
    uploaded_image_urls: null,
    collateral_image_selections: {},
    listing_image_meta: {},
    scraped_listing_json: null,
    public_slug: null,
    public_url: null,
    custom_landing_url: null,
    landing_qr_code_url: null,
    landing_published_at: null,
    landing_template: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function isPersistedListing(listing: Pick<Listing, "id">) {
  return Boolean(listing.id);
}
