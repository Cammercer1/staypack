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
  "bedrooms": number | null,
  "bathrooms": number | null,
  "carSpaces": number | null,
  "description": string | null,
  "displayPrice": string | null,
  "images": string[],
  "agents": [{ "name": string | null, "email": string | null, "phone": string | null }],
  "confidence": "low" | "medium" | "high",
  "warnings": string[]
}

Rules:
- Use only data present in the supplied page content.
- Do not invent amenities, prices, bed/bath counts, or images.
- Prefer full street addresses when available.
- Australian states should be 2-3 letter codes when possible (QLD, NSW, VIC, etc).
- images must be absolute URLs from the supplied image list or page content.
- Exclude logos, icons, agent headshots, and tiny thumbnails when possible.
- Keep description concise but faithful (max ~1200 chars).
- displayPrice must be a concise human-readable price (e.g. "$2,300,000 – $2,500,000" or "Offers over $1,200,000"), not portal labels like "Price Range".
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
    bedrooms: raw.bedrooms ?? undefined,
    bathrooms: raw.bathrooms ?? undefined,
    carSpaces: raw.carSpaces ?? undefined,
    description: raw.description ?? undefined,
    displayPrice: normalizeDisplayPrice(raw.displayPrice),
    images: [...new Set(raw.images.filter(Boolean))],
    agents: raw.agents
      .filter((agent) => agent.name || agent.email || agent.phone)
      .map((agent) => ({
        name: agent.name ?? undefined,
        email: agent.email ?? undefined,
        phone: agent.phone ?? undefined,
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
