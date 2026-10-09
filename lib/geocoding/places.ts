import "server-only";
import { z } from "zod";

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

export async function autocompleteAddresses(input: string, sessionToken: string): Promise<AddressSuggestion[]> {
  const data = predictionSchema.parse(await placesRequest(
    "places:autocomplete",
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    { method: "POST", body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["au"], regionCode: "au", languageCode: "en", includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"] }) },
  ));
  const suggestions = data.suggestions.flatMap(({ placePrediction: p }) => p ? [{
    placeId: p.placeId,
    address: p.text.text,
    mainText: p.structuredFormat?.mainText.text ?? p.text.text,
    secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
  }] : []).slice(0, 5);
  // Google can rank reversed Australian unit/street numbers first (22A/12 vs 12/22A).
  // Prioritize an exact number match without changing any suggestion's address.
  const numbers = (text: string) => text.match(/^(?:(?:unit|apartment|apt)\s*)?(\d+[a-z]?\s*\/\s*\d+[a-z]?(?:\s*[-–]\s*\d+[a-z]?)?)/i)?.[1].replace(/\s/g, "").replace(/–/g, "-").toLowerCase();
  const inputNumbers = numbers(input);
  return inputNumbers ? suggestions.sort((a, b) => Number(numbers(b.mainText) === inputNumbers) - Number(numbers(a.mainText) === inputNumbers)) : suggestions;
}

export async function completePlaceAddress(placeId: string, sessionToken: string, selectedAddress: string) {
  const params = new URLSearchParams({ sessionToken, languageCode: "en", regionCode: "au" });
  const data = detailsSchema.parse(await placesRequest(
    `places/${encodeURIComponent(placeId)}?${params}`,
    "formattedAddress,addressComponents",
  ));
  const component = (type: string, short = false) => {
    const c = data.addressComponents.find((item) => item.types.includes(type));
    return (short ? c?.shortText : c?.longText) ?? "";
  };
  if (component("country", true) !== "AU") throw new Error("Choose an Australian property address.");
  // Details can resolve to a building even when the chosen prediction includes a unit.
  // Keep the street the user selected; use Details to complete the locality/postcode.
  const street = selectedAddress.split(",")[0].trim();
  const locality = [component("locality") || component("postal_town"), component("administrative_area_level_1", true), component("postal_code")].filter(Boolean).join(" ");
  return locality ? `${street}, ${locality}` : selectedAddress.replace(/,?\s*Australia$/i, "");
}
