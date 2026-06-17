import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  brochureCopyFromPageOneAi,
  enforceSalesBrochureCopyLimits,
  getSalesBrochureCopyPromptLimits,
} from "@/lib/collateral/sales-brochure/copyLimits";
import { getMockSalesBrochureCopy } from "@/lib/collateral/buildSalesBrochureDocument";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";
import {
  PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  PAGE_ONE_COPY_MAX_ATTEMPTS,
  buildPageOneCopyRepairPrompt,
  pageOneFromAiShape,
  pageOneMarketingCopyAiSchema,
} from "@/lib/copy/pageOneMarketingCopy";
import { salesBrochureCopySchema } from "@/lib/validation/schemas";
import { isDevelopment } from "@/lib/env";
import type { Agency, Listing } from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";

const SYSTEM_PROMPT = `You are a real estate copywriter for Australian property agents.

Write clear, buyer-facing copy for a print-ready open-home sales brochure page 1.

Rules:
- Use Australian English.
- Be helpful and specific but not hypey.
- Do not guarantee outcomes or invent amenities, distances, approvals or returns.
- Do not mention short-term rental income, Airbtics, or investment yields.
- Use only the supplied property data.
- Do not mention OpenAI.
- Output valid JSON only with exactly the fields in the contract (heading, three blurb lengths, bullets).`;

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
  let raw: unknown = first;

  for (let attempt = 0; attempt < PAGE_ONE_COPY_MAX_ATTEMPTS; attempt += 1) {
    const parsed = parseCopyResponse(raw, agency);

    if (parsed.success) {
      return parsed.data;
    }

    if (attempt === PAGE_ONE_COPY_MAX_ATTEMPTS - 1) {
      throw new SalesBrochureCopyValidationError();
    }

    raw = await requestCopy(client, userPayload, {
      invalidJson: raw,
      validationErrors: parsed.error.flatten(),
    });
  }

  throw new SalesBrochureCopyValidationError();
}

function buildUserPayload({ agency, listing }: { agency: Agency; listing: Listing }) {
  return {
    agency: {
      name: agency.name,
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
    output_schema: PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  };
}

function parseCopyResponse(raw: unknown, agency: Agency) {
  const pageOneParsed = pageOneMarketingCopyAiSchema.safeParse(raw);

  if (!pageOneParsed.success) {
    return pageOneParsed;
  }

  const pageOne = pageOneFromAiShape(pageOneParsed.data);
  const brochure = brochureCopyFromPageOneAi(pageOne, {
    inspection_cta: agency.default_cta?.trim() || "",
    disclaimer: agency.default_disclaimer?.trim() || DEFAULT_DISCLAIMER,
  });
  const parsed = salesBrochureCopySchema.safeParse(brochure);

  if (!parsed.success) {
    return parsed;
  }

  return {
    success: true as const,
    data: parsed.data,
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
      model: "gpt-5.4-mini",
      response_format: zodResponseFormat(
        pageOneMarketingCopyAiSchema,
        "sales_brochure_copy",
      ),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: repair
            ? buildPageOneCopyRepairPrompt(payload, repair.invalidJson, repair.validationErrors)
            : `${JSON.stringify(payload)}\n\n${PAGE_ONE_MARKETING_COPY_JSON_CONTRACT}${
                copyLimits ? `\n\n${copyLimits}` : ""
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
