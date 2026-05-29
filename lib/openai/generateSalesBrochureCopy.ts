import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { enforceSalesBrochureCopyLimits } from "@/lib/collateral/sales-brochure/copyLimits";
import { coerceSalesBrochureCopy } from "@/lib/collateral/sales-brochure/propertyHighlights";
import { getSalesBrochureCopyPromptLimits } from "@/lib/collateral/sales-brochure/copyLimits";
import { normalizeSalesBrochureCopy } from "@/lib/collateral/sales-brochure/normalizeSalesBrochureCopy";
import { getMockSalesBrochureCopy } from "@/lib/collateral/buildSalesBrochureDocument";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";
import {
  salesBrochureCopyAiSchema,
  salesBrochureCopySchema,
} from "@/lib/validation/schemas";
import { isDevelopment } from "@/lib/env";
import type { Agency, Listing } from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";

const SYSTEM_PROMPT = `You are a real estate copywriter for Australian property agents.

Write clear, buyer-facing copy for a print-ready open-home sales brochure.

Rules:
- Use Australian English.
- Be helpful and specific but not hypey.
- Do not guarantee outcomes or invent amenities, distances, approvals or returns.
- Do not mention short-term rental income, Airbtics, or investment yields.
- Use only the supplied property data.
- Do not mention OpenAI.
- Output valid JSON only.`;

const JSON_CONTRACT = `Return JSON with exactly these snake_case fields:
- heading: string
- blurb: string
- property_highlights: string[]
- inspection_cta: string
- disclaimer: string`;

export class SalesBrochureCopyValidationError extends Error {
  code = "validation_failed" as const;

  constructor(message = "Failed to validate generated brochure copy") {
    super(message);
    this.name = "SalesBrochureCopyValidationError";
  }
}

export class SalesBrochureCopyOpenAIError extends Error {
  code = "openai_error" as const;

  constructor(message: string) {
    super(message);
    this.name = "SalesBrochureCopyOpenAIError";
  }
}

export async function generateSalesBrochureCopy({
  agency,
  listing,
}: {
  agency: Agency;
  listing: Listing;
}): Promise<SalesBrochureCopyJson> {
  if (!process.env.OPENAI_API_KEY) {
    if (isDevelopment()) {
      return enforceSalesBrochureCopyLimits(
        getMockSalesBrochureCopy(listing, agency),
      );
    }

    throw new SalesBrochureCopyOpenAIError("Copy generation is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userPayload = buildUserPayload({ agency, listing });

  const first = await requestCopy(client, userPayload);
  const parsed = parseCopyResponse(first, agency);

  if (parsed.success) {
    return parsed.data;
  }

  const repaired = await requestCopy(client, userPayload, {
    invalidJson: first,
    validationErrors: parsed.error.flatten(),
  });
  const repairedParsed = parseCopyResponse(repaired, agency);

  if (!repairedParsed.success) {
    throw new SalesBrochureCopyValidationError();
  }

  return repairedParsed.data;
}

function buildUserPayload({ agency, listing }: { agency: Agency; listing: Listing }) {
  return {
    agency: {
      name: agency.name,
      default_cta: agency.default_cta,
      default_disclaimer: agency.default_disclaimer ?? DEFAULT_DISCLAIMER,
    },
    property: {
      address: listing.property_address,
      suburb: listing.suburb,
      state: listing.state,
      postcode: listing.postcode,
      property_type: listing.property_type,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      car_spaces: listing.car_spaces,
      listing_title: listing.listing_title,
      listing_description: listing.listing_description,
      display_price: listing.display_price,
    },
    copy_limits: getSalesBrochureCopyPromptLimits(),
    output_schema: JSON_CONTRACT,
  };
}

function parseCopyResponse(raw: unknown, agency: Agency) {
  const coerced = coerceSalesBrochureCopy(normalizeSalesBrochureCopy(raw, agency));
  const parsed = salesBrochureCopySchema.safeParse(coerced);

  if (!parsed.success) {
    return parsed;
  }

  return {
    success: true as const,
    data: enforceSalesBrochureCopyLimits(coerced),
  };
}

async function requestCopy(
  client: OpenAI,
  payload: unknown,
  repair?: {
    invalidJson: unknown;
    validationErrors: unknown;
  },
) {
  try {
    const payloadObject =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;
    const copyLimits =
      typeof payloadObject?.copy_limits === "string"
        ? payloadObject.copy_limits
        : null;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: zodResponseFormat(salesBrochureCopyAiSchema, "sales_brochure_copy"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: repair
            ? `Repair the invalid JSON below. Fix only validation issues and return valid JSON matching the schema.\n\nValidation errors:\n${JSON.stringify(repair.validationErrors)}\n\nInvalid JSON:\n${JSON.stringify(repair.invalidJson)}\n\nSource payload:\n${JSON.stringify(payload)}`
            : `${JSON.stringify(payload)}\n\n${JSON_CONTRACT}${
                copyLimits ? `\n\nCharacter limits:\n${copyLimits}` : ""
              }`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new SalesBrochureCopyOpenAIError("Copy generation returned empty content");
    }

    return JSON.parse(text);
  } catch (error) {
    if (
      error instanceof SalesBrochureCopyOpenAIError ||
      error instanceof SalesBrochureCopyValidationError
    ) {
      throw error;
    }

    throw new SalesBrochureCopyOpenAIError(
      error instanceof Error ? error.message : "Copy generation failed",
    );
  }
}
