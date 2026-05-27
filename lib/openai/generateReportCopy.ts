import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { Agency, AiCopyJson, Report, StrEstimate } from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { aiCopySchema } from "@/lib/validation/schemas";
import { getMockAiCopy } from "@/lib/reports/buildFinalReportJson";
import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import { normalizeAiCopy } from "@/lib/reports/normalizeAiCopy";
import { enforceTemplateCopyLimits } from "@/lib/reports/enforceTemplateCopyLimits";
import { getClassicCopyPromptLimits } from "@/lib/reports/templates/classic/copyLimits";
import { isClassicTemplateId } from "@/lib/reports/templates/ids";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import { isDevelopment } from "@/lib/env";

const SYSTEM_PROMPT = `You are a real estate sales pack copywriter for Australian property agents.

Write clear, useful, buyer-facing copy for a short-term rental potential report.

Rules:
- Use Australian English.
- Be commercially useful but conservative.
- Do not use hype.
- Do not guarantee income.
- Do not call revenue profit.
- Use "estimated gross short-term rental revenue".
- Do not invent amenities, distances, approvals, regulations, tax treatment or returns.
- Use only the supplied property data.
- Do not mention Airbtics.
- Do not mention OpenAI.
- If long-term rental data is available, compare carefully before costs.
- If long-term rental data is missing, do not mention uplift.
- Output valid JSON only.`;

const JSON_CONTRACT = `Return JSON with exactly these snake_case fields:
- sales_pack_heading: string
- sales_pack_blurb: string
- key_metrics_line: string
- property_appeal_points: string[]
- performance_supporting_factors: string[]
- buyer_checks: string[]
- methodology_note: string
- disclaimer: string
- confidence_notes: string (internal staff notes only, not shown to buyers)`;

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
  report: Report;
  estimate: StrEstimate;
};

export async function generateReportCopy({
  agency,
  report,
  estimate,
}: GenerateCopyInput): Promise<AiCopyJson> {
  if (!process.env.OPENAI_API_KEY) {
    if (isDevelopment()) {
      return getMockAiCopy(report, agency);
    }

    throw new CopyOpenAIError("Copy generation is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const templateId = resolveReportTemplateId(agency, report);
  const userPayload = buildUserPayload({ agency, report, estimate, templateId });

  const first = await requestCopy(client, userPayload);
  const parsed = parseCopyResponse(first, agency, templateId);

  if (parsed.success) {
    return parsed.data;
  }

  console.error("Initial copy validation failed:", parsed.error.flatten());

  const repaired = await requestCopy(client, userPayload, {
    invalidJson: first,
    validationErrors: parsed.error.flatten(),
  });
  const repairedParsed = parseCopyResponse(repaired, agency, templateId);

  if (!repairedParsed.success) {
    console.error("Repair copy validation failed:", repairedParsed.error.flatten());
    throw new CopyValidationError();
  }

  return repairedParsed.data;
}

function buildUserPayload({
  agency,
  report,
  estimate,
  templateId,
}: GenerateCopyInput & { templateId: string }) {
  const scraped = report.scraped_listing_json as
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
      default_cta: agency.default_cta,
      default_disclaimer: agency.default_disclaimer ?? DEFAULT_DISCLAIMER,
    },
    property: {
      address: report.property_address,
      suburb: report.suburb,
      state: report.state,
      postcode: report.postcode,
      property_type: report.property_type,
      bedrooms: report.bedrooms,
      bathrooms: report.bathrooms,
      car_spaces: report.car_spaces,
      listing_title: report.listing_title,
      listing_description: report.listing_description,
      display_price: report.display_price,
    },
    estimate: {
      annual_revenue: estimate.annualRevenue,
      monthly_revenue: estimate.monthlyRevenue,
      weekly_revenue: estimate.weeklyRevenue,
      nightly_rate: estimate.nightlyRate,
      occupancy_rate: estimate.occupancyRate,
      booked_nights: estimate.bookedNights,
      radius_m: estimate.radiusM,
      formatted: {
        annual_revenue: formatCurrency(estimate.annualRevenue),
        monthly_revenue: formatCurrency(estimate.monthlyRevenue),
        weekly_revenue: formatCurrency(estimate.weeklyRevenue),
        nightly_rate: formatCurrency(estimate.nightlyRate),
        occupancy_rate: formatPercent(estimate.occupancyRate),
        booked_nights: estimate.bookedNights ?? "—",
      },
    },
    long_term_rental: scraped?.rentalAppraisal ?? null,
    template_id: templateId,
    copy_limits: isClassicTemplateId(templateId)
      ? getClassicCopyPromptLimits(templateId)
      : null,
    output_schema: JSON_CONTRACT,
  };
}

function parseCopyResponse(raw: unknown, agency: Agency, templateId: string) {
  const parsed = aiCopySchema.safeParse(normalizeAiCopy(raw, agency));

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
      model: "gpt-4.1-mini",
      response_format: zodResponseFormat(aiCopySchema, "report_copy"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: repair
            ? `Repair the invalid JSON below. Fix only validation issues and return valid JSON matching the schema.\n\nValidation errors:\n${JSON.stringify(repair.validationErrors)}\n\nInvalid JSON:\n${JSON.stringify(repair.invalidJson)}\n\nSource payload:\n${JSON.stringify(payload)}`
            : `${JSON.stringify(payload)}\n\n${JSON_CONTRACT}${
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
