import OpenAI from "openai";
import { isDevelopment } from "@/lib/env";
import type { Listing } from "@/lib/types";

export type ListingDescriptionInput = Pick<
  Listing,
  | "property_address"
  | "suburb"
  | "state"
  | "postcode"
  | "property_type"
  | "bedrooms"
  | "bathrooms"
  | "car_spaces"
  | "accommodates"
  | "display_price"
  | "listing_title"
  | "listing_description"
  | "scraped_listing_json"
>;

function buildPropertyDetails(listing: ListingDescriptionInput) {
  return [
    listing.listing_title ? `Title: ${listing.listing_title}` : null,
    listing.property_address,
    [listing.suburb, listing.state, listing.postcode].filter(Boolean).join(", "),
    listing.property_type ? `Property type: ${listing.property_type}` : null,
    listing.bedrooms != null ? `${listing.bedrooms} bedrooms` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bathrooms` : null,
    listing.car_spaces != null ? `${listing.car_spaces} car spaces` : null,
    listing.accommodates != null
      ? `Accommodates up to ${listing.accommodates} guests`
      : null,
    listing.display_price ? `Listed at ${listing.display_price}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildListingDescriptionPrompt(listing: ListingDescriptionInput) {
  const scraped = listing.scraped_listing_json;
  const sourceDescription =
    scraped?.description?.trim() ||
    listing.listing_description?.trim() ||
    "";

  return `You are a real estate copywriter for Australian property agents.
Write a compelling, buyer-facing property description for the listing below.

Format rules:
- Use markdown. Use ## for section headings (2–3 max), plain paragraphs for body text.
- Good section headings are things like "## The Home", "## Entertaining & Outdoors", "## Location & Lifestyle" — use only what's warranted by the property details.
- Each section gets 1–2 paragraphs. No bullet points.
- Start with a punchy opening sentence (no heading) that sets the scene.
- Aim for 350–500 words total — enough for a full listing webpage.
- Do not invent amenities, distances, approvals, regulations or returns not provided.
- Use Australian English.
- Do not mention price or STR/investment returns.
- No hype words: "stunning", "magnificent", "rare opportunity", "dream home".
- Tone: warm, confident, factual. Write like a great agent, not a marketing robot.
- Output only the markdown — no preamble, no code fences.

Property details:
${buildPropertyDetails(listing)}

${
  sourceDescription
    ? `Source listing copy (expand and rewrite into the format above — do not copy verbatim):\n${sourceDescription}`
    : ""
}`.trim();
}

function getMockListingDescription(listing: ListingDescriptionInput) {
  const address =
    listing.property_address ??
    [listing.suburb, listing.state].filter(Boolean).join(", ") ??
    "this property";
  const bedrooms = listing.bedrooms != null ? `${listing.bedrooms}-bedroom` : "";
  const type = listing.property_type?.toLowerCase() ?? "home";

  return `${address} offers a practical ${bedrooms} ${type} layout with room to move.

## The Home

The floorplan balances everyday living with flexible spaces that suit a range of buyers. Natural light, sensible zoning and low-maintenance finishes make the home easy to live in from day one.

## Location & Lifestyle

Set in ${listing.suburb ?? "a well-connected pocket"}, the address keeps daily errands, schools and transport within easy reach while still feeling residential and calm.`;
}

export async function generateListingDescription(
  listing: ListingDescriptionInput,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    if (isDevelopment()) {
      return getMockListingDescription(listing);
    }

    throw new Error("Description generation is not configured");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: buildListingDescriptionPrompt(listing) }],
    max_tokens: 1200,
    temperature: 0.65,
  });

  const description = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!description) {
    throw new Error("AI returned an empty description");
  }

  return description;
}
