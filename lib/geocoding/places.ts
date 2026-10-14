import "server-only";
import { z } from "zod";
import { preserveUsStreet, usStreetAddress } from "@/lib/us-property/address";

export type AddressSuggestion = {
  placeId: string;
  address: string;
  mainText: string;
  secondaryText: string;
};

const predictionSchema = z.object({
  suggestions: z.array(z.object({
    placePrediction: z.object({
      placeId: z.string(),
      text: z.object({ text: z.string() }),
      structuredFormat: z.object({
        mainText: z.object({ text: z.string() }),
        secondaryText: z.object({ text: z.string() }).optional(),
      }).optional(),
    }).optional(),
  })).default([]),
});
const detailsSchema = z.object({
  formattedAddress: z.string(),
  addressComponents: z.array(z.object({
    longText: z.string().optional(), shortText: z.string().optional(), types: z.array(z.string()),
  })).default([]),
});

async function placesRequest(path: string, fields: string, init?: RequestInit) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Address suggestions are unavailable. You can still type the address.");
  const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Address suggestions are unavailable. You can still type the address.");
  return response.json();
}

export async function autocompleteAddresses(input: string, sessionToken: string, country: "AU" | "US" = "AU"): Promise<AddressSuggestion[]> {
  const normalizedInput = input.trim().replace(/[–—−]/g, "-");
  // Search the building separately: Places can transpose Australian unit/range
  // inputs such as 21/8-12 into 8 12/21. The unit remains user-supplied.
  const apartmentRange = normalizedInput.match(/^(?:(?:unit|apartment|apt)\s*)?(\d+[a-z]?)\s*(?:\/|,\s*)\s*(\d+[a-z]?)\s*-\s*(\d+[a-z]?)\s+(.+)$/i);
  const buildingNumber = apartmentRange ? `${apartmentRange[2]}-${apartmentRange[3]}` : null;
  const searchInput = apartmentRange ? `${buildingNumber} ${apartmentRange[4]}` : input;
  const data = predictionSchema.parse(await placesRequest(
    "places:autocomplete",
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    { method: "POST", body: JSON.stringify({ input: searchInput, sessionToken, includedRegionCodes: [country.toLowerCase()], regionCode: country.toLowerCase(), languageCode: "en", includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"] }) },
  ));
  const suggestions = data.suggestions.flatMap(({ placePrediction: p }) => p ? [{
    placeId: p.placeId,
    address: p.text.text,
    mainText: p.structuredFormat?.mainText.text ?? p.text.text,
    secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
  }] : []).slice(0, 5);
  if (country === "US") {
    return suggestions.flatMap((suggestion) => {
      const mainText = preserveUsStreet(input, suggestion.mainText);
      if (!mainText) return [];
      return [{ ...suggestion, mainText, address: [mainText, suggestion.secondaryText].filter(Boolean).join(", ") }];
    });
  }
  if (apartmentRange) {
    const seen = new Set<string>();
    return suggestions.flatMap((suggestion) => {
      const street = suggestion.address.split(",")[0].trim().replace(/[–—−]/g, "-");
      const match = street.match(/^(?:(?:(?:unit|apartment|apt)\s*)?(\d+[a-z]?)\s*\/\s*)?(\d+[a-z]?)\s*-\s*(\d+[a-z]?)\s+(.+)$/i);
      // Don't attach a unit to a different building or to somebody else's unit.
      if (!match || `${match[2]}-${match[3]}`.toLowerCase() !== buildingNumber!.toLowerCase() ||
        (match[1] && match[1].toLowerCase() !== apartmentRange[1].toLowerCase())) return [];
      const mainText = `${apartmentRange[1]}/${buildingNumber} ${match[4]}`;
      const comma = suggestion.address.indexOf(",");
      const address = mainText + (comma < 0 ? "" : suggestion.address.slice(comma));
      if (seen.has(address.toLowerCase())) return [];
      seen.add(address.toLowerCase());
      return [{ ...suggestion, mainText, address }];
    });
  }
  // Google can rank reversed Australian unit/street numbers first (22A/12 vs 12/22A).
  // Prioritize an exact number match without changing any suggestion's address.
  const numbers = (text: string) => text.match(/^(?:(?:unit|apartment|apt)\s*)?(\d+[a-z]?\s*\/\s*\d+[a-z]?(?:\s*[-–]\s*\d+[a-z]?)?)/i)?.[1].replace(/\s/g, "").replace(/–/g, "-").toLowerCase();
  const inputNumbers = numbers(input);
  return inputNumbers ? suggestions.sort((a, b) => Number(numbers(b.mainText) === inputNumbers) - Number(numbers(a.mainText) === inputNumbers)) : suggestions;
}

export async function completePlaceAddress(placeId: string, sessionToken: string, selectedAddress: string, country: "AU" | "US" = "AU") {
  const params = new URLSearchParams({ sessionToken, languageCode: "en", regionCode: country.toLowerCase() });
  const data = detailsSchema.parse(await placesRequest(
    `places/${encodeURIComponent(placeId)}?${params}`,
    "formattedAddress,addressComponents",
  ));
  const component = (type: string, short = false) => {
    const c = data.addressComponents.find((item) => item.types.includes(type));
    return (short ? c?.shortText : c?.longText) ?? "";
  };
  if (component("country", true) !== country) throw new Error("Choose a property address in the selected country.");
  // Details can resolve to a building even when the chosen prediction includes a unit.
  // Keep the street the user selected; use Details to complete the locality/postcode.
  const street = country === "US" ? usStreetAddress(selectedAddress) : selectedAddress.split(",")[0].trim();
  const locality = [component("locality") || component("postal_town"), component("administrative_area_level_1", true), component("postal_code")].filter(Boolean).join(" ");
  return locality ? `${street}, ${locality}` : selectedAddress.replace(/,?\s*Australia$/i, "");
}

/** Address discovery stays in Google Places; property data is fetched only after selection. */
export async function searchPlaceProperties(query: string, country: "AU" | "US"): Promise<import("@/lib/listings/propertyLookupTypes").PropertyCandidate[]> {
  const sessionToken = crypto.randomUUID();
  const suggestions = await autocompleteAddresses(query, sessionToken, country);
  const candidates = await Promise.all(suggestions.map(async suggestion => {
    const data = detailsSchema.parse(await placesRequest(`places/${encodeURIComponent(suggestion.placeId)}?${new URLSearchParams({ sessionToken, languageCode: "en", regionCode: country.toLowerCase() })}`, "formattedAddress,addressComponents"));
    const component = (type: string, short = false) => { const c = data.addressComponents.find(c => c.types.includes(type)); return (short ? c?.shortText : c?.longText) ?? ""; };
    if (component("country", true) !== country) return null;
    const streetAddress = country === "US" ? usStreetAddress(suggestion.address) : suggestion.mainText;
    return { source: "google" as const, country, placeId: suggestion.placeId, address: suggestion.address, streetAddress,
      suburb: component("locality") || component("postal_town"), state: component("administrative_area_level_1", true), postcode: component("postal_code") };
  }));
  return candidates.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
}
