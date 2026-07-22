import OpenAI from "openai";
import type { ParsedListing } from "@/lib/types";
import { parsedListingSchema, type ParsedListingInput } from "@/lib/validation/schemas";
import { isDevelopment } from "@/lib/env";
import {
  buildAiListingPromptPayload,
  prepareHtmlForAi,
} from "@/lib/scraping/prepareHtmlForAi";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";

const SYSTEM_PROMPT = `You extract structured property listing data from Australian real estate listing pages.

Return JSON only with this shape:
{
  "title": string | null,
  "address": string | null,
  "suburb": string | null,
  "state": string | null,
  "postcode": string | null,
  "propertyType": string | null,
  "purpose": "sale" | "lease" | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "carSpaces": number | null,
  "description": string | null,
  "displayPrice": string | null,
  "soldDate": string | null,
  "landAreaSqm": number | null,
  "floorAreaSqm": number | null,
  "images": string[],
  "agents": [{ "name": string | null, "email": string | null, "phone": string | null, "photo_url": string | null }],
  "confidence": "low" | "medium" | "high",
  "warnings": string[]
}

Rules:
- Use only data present in the supplied page content.
- Do not invent amenities, prices, bed/bath counts, or images.
- Prefer full street addresses when available.
- Australian states should be 2-3 letter codes when possible (QLD, NSW, VIC, etc).
- purpose is "lease" when the property is advertised for rent/lease (e.g. weekly rent, "for lease", "to rent"), otherwise "sale". Use null only when genuinely unclear.
- images must be absolute URLs from the supplied image list or page content.
- Exclude logos, icons, and tiny thumbnails when possible.
- For agents, use full phone numbers from tel: links or structured data. Never return masked numbers containing asterisks (e.g. "0497***").
- Keep description concise but faithful (max ~1200 chars).
- displayPrice must be a concise human-readable price (e.g. "$2,300,000 – $2,500,000" or "Offers over $1,200,000"), not portal labels like "Price Range".
- soldDate is only for a sold listing and must come from an explicit sold/date-sold field or statement on the page.
- landAreaSqm is the land or allotment area converted to square metres. floorAreaSqm is the internal, floor, or building area converted to square metres. Keep them separate and leave either null when unclear.
- If unsure, leave fields null and add a warning.
- confidence is high when address + at least one image + bed/bath are present, medium when address or major fields present, otherwise low.`;

type ParseListingInput = {
  html: string;
  url: string;
  fallback?: ParsedListing;
};

function normalizeAiListing(raw: ParsedListingInput): ParsedListing {
  return {
    title: raw.title ?? undefined,
    address: raw.address ?? undefined,
    suburb: raw.suburb ?? undefined,
    state: raw.state ?? undefined,
    postcode: raw.postcode ?? undefined,
    propertyType: raw.propertyType ?? undefined,
    purpose: raw.purpose ?? undefined,
    bedrooms: raw.bedrooms ?? undefined,
    bathrooms: raw.bathrooms ?? undefined,
    carSpaces: raw.carSpaces ?? undefined,
    description: raw.description ?? undefined,
    displayPrice: normalizeDisplayPrice(raw.displayPrice),
    soldDate: raw.soldDate ?? undefined,
    landAreaSqm: raw.landAreaSqm ?? undefined,
    floorAreaSqm: raw.floorAreaSqm ?? undefined,
    images: [...new Set(raw.images.filter(Boolean))],
    agents: raw.agents
      .filter((agent) => agent.name || agent.email || agent.phone)
      .map((agent) => ({
        name: agent.name ?? undefined,
        email: agent.email ?? undefined,
        phone: agent.phone ?? undefined,
        photo_url: agent.photo_url ?? undefined,
      })),
    confidence: raw.confidence,
    warnings: [...new Set(raw.warnings.filter(Boolean))],
  };
}

function getMockAiListing(fallback: ParsedListing | undefined): ParsedListing {
  return normalizeAiListing({
    ...(fallback ?? {
      images: [],
      agents: [],
      confidence: "low",
      warnings: [],
    }),
    warnings: [
      ...(fallback?.warnings ?? []),
      "Listing extraction used basic parsing only.",
    ],
    confidence: fallback?.confidence ?? "low",
  });
}

async function requestListingParse(
  client: OpenAI,
  payload: unknown,
  repair = false,
) {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: repair
          ? `Repair invalid JSON and return valid JSON only for this listing page payload:\n${JSON.stringify(payload)}`
          : JSON.stringify(payload),
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Listing extraction returned empty content");
  }

  return JSON.parse(text);
}

export async function parseListingFromHtml({
  html,
  url,
  fallback,
}: ParseListingInput): Promise<ParsedListing> {
  const prepared = prepareHtmlForAi(html, url);
  const payload = buildAiListingPromptPayload(prepared);

  if (!process.env.OPENAI_API_KEY) {
    if (isDevelopment()) {
      return getMockAiListing(fallback);
    }

    throw new Error("Listing extraction is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const first = await requestListingParse(client, payload);
  const parsed = parsedListingSchema.safeParse(first);

  if (parsed.success) {
    return normalizeAiListing(parsed.data);
  }

  const repaired = await requestListingParse(client, payload, true);
  const repairedParsed = parsedListingSchema.safeParse(repaired);

  if (!repairedParsed.success) {
    throw new Error("Failed to validate AI listing parse");
  }

  return normalizeAiListing(repairedParsed.data);
}
