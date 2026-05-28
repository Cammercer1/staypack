import { geocodeReportAddress, hasGeocodableAddress } from "@/lib/geocoding";
import {
  parsedListingSchema,
  type UpdateListingInput,
} from "@/lib/validation/schemas";
import type { Listing, ParsedListing } from "@/lib/types";

function syncLegacyLandingImages(prepared: UpdateListingInput) {
  // Legacy helper retained for any callers passing collateral_image_selections.landing
  if (prepared.collateral_image_selections?.landing) {
    const landing = prepared.collateral_image_selections.landing;
    prepared.hero_image_url =
      landing.hero_image_url ?? prepared.hero_image_url ?? null;
    prepared.selected_image_urls =
      landing.selected_image_urls ?? prepared.selected_image_urls ?? [];
  }
}

export async function prepareListingInput(body: UpdateListingInput) {
  const prepared = { ...body };

  if (prepared.listing_agents !== undefined) {
    const currentScraped = parsedListingSchema.parse({
      images: [],
      agents: [],
      confidence: "low",
      warnings: [],
    });
    const listingAgents = prepared.listing_agents
      .map((agent) => ({
        name: agent.name.trim(),
        email: agent.email?.trim() || undefined,
        phone: agent.phone?.trim() || undefined,
        role_title: agent.role_title?.trim() || undefined,
        photo_url: agent.photo_url?.trim() || undefined,
      }))
      .filter((agent) => agent.name);

    prepared.scraped_listing_json = {
      ...currentScraped,
      agents: listingAgents,
    };
    delete prepared.listing_agents;
  }

  let geocodeWarning: string | undefined;

  if (
    hasGeocodableAddress(prepared) &&
    (prepared.latitude == null || prepared.longitude == null)
  ) {
    try {
      const geocoded = await geocodeReportAddress(prepared);
      prepared.latitude = geocoded.latitude;
      prepared.longitude = geocoded.longitude;
    } catch (error) {
      geocodeWarning =
        error instanceof Error
          ? error.message
          : "Unable to geocode property address";
    }
  }

  syncLegacyLandingImages(prepared);

  return { prepared, geocodeWarning };
}

const ADDRESS_FIELDS = [
  "property_address",
  "suburb",
  "state",
  "postcode",
  "country",
] as const;

export async function prepareListingPatch(
  body: UpdateListingInput,
  existing: Pick<
    UpdateListingInput,
    (typeof ADDRESS_FIELDS)[number] | "latitude" | "longitude"
  > & {
    scraped_listing_json?: ParsedListing | null;
  },
) {
  const prepared = { ...body };

  if (prepared.listing_agents !== undefined) {
    const currentScraped = parsedListingSchema.parse(
      existing.scraped_listing_json ?? {
        images: [],
        agents: [],
        confidence: "low",
        warnings: [],
      },
    );
    const listingAgents = prepared.listing_agents
      .map((agent) => ({
        name: agent.name.trim(),
        email: agent.email?.trim() || undefined,
        phone: agent.phone?.trim() || undefined,
        role_title: agent.role_title?.trim() || undefined,
        photo_url: agent.photo_url?.trim() || undefined,
      }))
      .filter((agent) => agent.name);

    prepared.scraped_listing_json = {
      ...currentScraped,
      agents: listingAgents,
    };
    delete prepared.listing_agents;
  }

  const nextListing = {
    property_address: prepared.property_address ?? existing.property_address,
    suburb: prepared.suburb ?? existing.suburb,
    state: prepared.state ?? existing.state,
    postcode: prepared.postcode ?? existing.postcode,
    country: prepared.country ?? existing.country,
  };

  const addressChanged = ADDRESS_FIELDS.some((field) => field in body);
  let geocodeWarning: string | undefined;

  if (
    addressChanged &&
    hasGeocodableAddress(nextListing) &&
    (prepared.latitude == null || prepared.longitude == null)
  ) {
    try {
      const geocoded = await geocodeReportAddress(nextListing);
      prepared.latitude = geocoded.latitude;
      prepared.longitude = geocoded.longitude;
    } catch (error) {
      geocodeWarning =
        error instanceof Error
          ? error.message
          : "Unable to geocode property address";
    }
  }

  syncLegacyLandingImages(prepared);

  return { prepared, geocodeWarning };
}
