import { isDevelopment } from "@/lib/env";
import {
  buildAddressQuery,
  hasGeocodableAddress,
} from "@/lib/geocoding/buildAddressQuery";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
};

type AddressInput = {
  property_address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
};

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{
    formatted_address: string;
    place_id: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
  error_message?: string;
};

export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Address is required for geocoding");
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    if (isDevelopment()) {
      return getMockGeocode(trimmed);
    }

    throw new Error("Address lookup is not configured");
  }

  const params = new URLSearchParams({
    address: trimmed,
    key: apiKey,
    region: "au",
    components: "country:AU",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Address lookup failed (${response.status})`);
  }

  const payload = (await response.json()) as GoogleGeocodeResponse;

  if (payload.status !== "OK" || !payload.results?.[0]) {
    throw new Error(
      payload.error_message ??
        `Unable to geocode address (${payload.status || "unknown"})`,
    );
  }

  const result = payload.results[0];

  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  };
}

export async function geocodeReportAddress(input: AddressInput) {
  if (!hasGeocodableAddress(input)) {
    throw new Error("Property address is required before geocoding");
  }

  return geocodeAddress(buildAddressQuery(input));
}

function getMockGeocode(query: string): GeocodeResult {
  return {
    latitude: -28.0167,
    longitude: 153.4,
    formattedAddress: query,
    placeId: "mock-place-id",
  };
}
