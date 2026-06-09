import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { Agency, AiCopyJson, Listing, Report, StrEstimate } from "@/lib/types";
import { getMockAiCopy } from "@/lib/reports/buildFinalReportJson";
import { enforceTemplateCopyLimits } from "@/lib/reports/enforceTemplateCopyLimits";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import { isDevelopment } from "@/lib/env";
import {
  PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  getPageOneMarketingCopyPromptLimits,
  pageOneFromAiShape,
  pageOneMarketingCopyAiSchema,
  pageOneToAiCopyJson,
} from "@/lib/copy/pageOneMarketingCopy";
import { aiCopySchema } from "@/lib/validation/schemas";

const SYSTEM_PROMPT = `You are a real estate sales pack copywriter for Australian property agents.

Write page-1 copy for a short-term rental (STR) potential report aimed at property investors and buyers weighing income potential.

Blurb tone and purpose:
- Get the investor excited about the property's STR appeal — location, layout, features, guest demand drivers, and estimated revenue opportunity.
- Write with confident, commercially compelling prose. Sell the upside of the asset and the market story.
- Use concrete details from the listing (renovations, amenities, proximity, layout) to build desire.

Blurb must NOT contain disclaimer or hedge language. A separate disclaimer block is rendered elsewhere on the page. Never put any of the following in blurb or bullets:
- Caveats about performance varying, risks, costs, management, seasonality, or "actual results"
- Phrases like "may vary", "can vary", "depending on", "subject to", "not guaranteed", "buyers should", "enquiries", "conditions apply"
- Methodology, data-source, or compliance-style sentences
- Occupancy or ADR stats used as warnings rather than positive market context

Revenue in blurb:
- You may reference estimated gross short-term rental revenue once, framed as an opportunity (not a promise).
- Do not call revenue profit.
- Do not guarantee income.

Other rules:
- Use Australian English.
- Do not invent amenities, distances, approvals, regulations, or tax treatment.
- Use only the supplied property data.
- Do not mention Airbtics or OpenAI.
- Output valid JSON only with exactly the fields in the contract (heading, three blurb lengths, bullets).`;

export class CopyValidationError extends Error {
  code = "validation_failed" as const;

  constructor(message = "Failed to validate generated report copy") {
    super(message);
    this.name = "CopyValidationError";
  }
}

export class CopyOpenAIError extends Error {
  code = "openai_error" as const;

  constructor(message: string) {
    super(message);
    this.name = "CopyOpenAIError";
  }
}

type GenerateCopyInput = {
  agency: Agency;
  listing: Listing;
  report: Report;
  estimate: StrEstimate;
};

export async function generateReportCopy({
  agency,
  listing,
  report,
  estimate,
}: GenerateCopyInput): Promise<AiCopyJson> {
  if (!process.env.OPENAI_API_KEY) {
    if (isDevelopment()) {
      return getMockAiCopy(listing, agency);
    }

    throw new CopyOpenAIError("Copy generation is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const templateId = resolveReportTemplateId(agency, report);
  const userPayload = buildUserPayload({ agency, listing, report, estimate, templateId });

  const first = await requestCopy(client, userPayload);
  const parsed = parseCopyResponse(first, agency, estimate, templateId);

  if (parsed.success) {
    return parsed.data;
  }

  console.error("Initial copy validation failed:", parsed.error.flatten());

  const repaired = await requestCopy(client, userPayload, {
    invalidJson: first,
    validationErrors: parsed.error.flatten(),
  });
  const repairedParsed = parseCopyResponse(repaired, agency, estimate, templateId);

  if (!repairedParsed.success) {
    console.error("Repair copy validation failed:", repairedParsed.error.flatten());
    throw new CopyValidationError();
  }

  return repairedParsed.data;
}

function buildUserPayload({
  agency,
  listing,
  report,
  estimate,
  templateId,
}: GenerateCopyInput & { templateId: string }) {
  const scraped = listing.scraped_listing_json as
    | {
        rentalAppraisal?: {
          weeklyMin?: number;
          weeklyMax?: number;
          weeklyMidpoint?: number;
        };
      }
    | null
    | undefined;

  return {
    agency: {
      name: agency.name,
      default_report_title: agency.default_report_title,
      default_disclaimer: agency.default_disclaimer,
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
    estimate: {
      annual_revenue: estimate.annualRevenue,
      monthly_revenue: estimate.monthlyRevenue,
      weekly_revenue: estimate.weeklyRevenue,
      nightly_rate: estimate.nightlyRate,
      occupancy_rate: estimate.occupancyRate,
      booked_nights: estimate.bookedNights,
      radius_m: estimate.radiusM,
    },
    long_term_rental: scraped?.rentalAppraisal ?? null,
    template_id: templateId,
    copy_limits: getPageOneMarketingCopyPromptLimits(),
    output_schema: PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  };
}

function parseCopyResponse(
  raw: unknown,
  agency: Agency,
  estimate: StrEstimate,
  templateId: string,
) {
  const pageOneParsed = pageOneMarketingCopyAiSchema.safeParse(raw);

  if (!pageOneParsed.success) {
    return pageOneParsed;
  }

  const pageOne = pageOneFromAiShape(pageOneParsed.data);
  const aiCopy = pageOneToAiCopyJson(pageOne, agency, estimate);
  const parsed = aiCopySchema.safeParse(aiCopy);

  if (!parsed.success) {
    return parsed;
  }

  return {
    success: true as const,
    data: enforceTemplateCopyLimits(parsed.data, templateId),
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
        "report_copy",
      ),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: repair
            ? `Repair the invalid JSON below. Fix only validation issues and return valid JSON matching the schema.\n\nValidation errors:\n${JSON.stringify(repair.validationErrors)}\n\nInvalid JSON:\n${JSON.stringify(repair.invalidJson)}\n\nSource payload:\n${JSON.stringify(payload)}`
            : `${JSON.stringify(payload)}\n\n${PAGE_ONE_MARKETING_COPY_JSON_CONTRACT}${
                copyLimits ? `\n\n${copyLimits}` : ""
              }`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new CopyOpenAIError("Copy generation returned empty content");
    }

    return JSON.parse(text);
  } catch (error) {
    if (error instanceof CopyOpenAIError || error instanceof CopyValidationError) {
      throw error;
    }

    throw new CopyOpenAIError(
      error instanceof Error ? error.message : "Copy generation failed",
    );
  }
}
