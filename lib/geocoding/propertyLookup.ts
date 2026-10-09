import type { PropertyCandidate } from "@/lib/listings/propertyLookupTypes";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";

type GoogleResult = {
  formatted_address: string;
  place_id: string;
  partial_match?: boolean;
  address_components: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
  geometry: { location: { lat: number; lng: number } };
};
async function googleResults(params: URLSearchParams): Promise<GoogleResult[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return [];
  params.set("key", key);
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    { cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error("Address lookup is unavailable.");
  const data = await response.json();
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK") throw new Error("Address lookup is unavailable.");
  return data.results ?? [];
}
function component(result: GoogleResult, type: string, short = false) {
  const found = result.address_components.find((c) => c.types.includes(type));
  return (short ? found?.short_name : found?.long_name) ?? "";
}
export async function searchGoogleProperties(
  query: string,
): Promise<PropertyCandidate[]> {
  const results = await googleResults(
    new URLSearchParams({
      address: query,
      region: "au",
      components: "country:AU",
    }),
  );
  return results.slice(0, 5).map((result) => {
    const unit = component(result, "subpremise").replace(/^unit\s+/i, "");
    const street =
      `${unit ? `${unit}/` : ""}${component(result, "street_number")} ${component(result, "route")}`.trim();
    return {
      source: "google",
      address: result.formatted_address,
      placeId: result.place_id,
      // Never drop or transpose a unit/range from a partial Google match.
      streetAddress: result.partial_match ? query.split(",")[0].trim() : street,
      suburb: component(result, "locality"),
      state: component(result, "administrative_area_level_1", true),
      postcode: component(result, "postal_code"),
      partialMatch: Boolean(result.partial_match),
    };
  });
}
export async function lookupGoogleProperty(candidate: PropertyCandidate) {
  const results = await googleResults(
    new URLSearchParams({ place_id: candidate.placeId ?? "" }),
  );
  const result = results.find((r) => r.place_id === candidate.placeId);
  if (!result)
    throw new Error(
      "The address could not be verified. Enter the details manually.",
    );
  const partial = candidate.partialMatch || result.partial_match;
  return createEmptyListingDraft({
    property_address: candidate.streetAddress,
    suburb: candidate.suburb,
    state: candidate.state,
    postcode: candidate.postcode,
    latitude: partial ? null : result.geometry.location.lat,
    longitude: partial ? null : result.geometry.location.lng,
    scraped_listing_json: {
      address: candidate.streetAddress,
      suburb: candidate.suburb,
      state: candidate.state,
      postcode: candidate.postcode,
      images: [],
      agents: [],
      confidence: partial ? "low" : "medium",
      warnings: [
        partial
          ? "Google returned a partial address match. Your original street address has been kept; confirm the unit and street number."
          : "Address found. Property details are unavailable, so enter the details you know.",
      ],
      propertyLookup: {
        source: "google",
        matchedAt: new Date().toISOString(),
        media: [],
      },
    },
  });
}
