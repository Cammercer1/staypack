import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  deriveLeaseAppraisalCopy,
  type LeaseAppraisalCopy,
} from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import { isDevelopment } from "@/lib/env";
import { LEASE_APPRAISAL_COMPARABLE_DISCLAIMER } from "@/lib/lease-appraisal/comparableEvidenceCopy";
import {
  PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  getPageOneMarketingCopyPromptLimits,
  pageOneFromAiShape,
  pageOneMediumBlurb,
  pageOneMarketingCopyAiSchema,
} from "@/lib/copy/pageOneMarketingCopy";
import type { Agency, Listing, LtrRentalCompCard, LtrSuburbMarketJson, ParsedListing } from "@/lib/types";

const SYSTEM_PROMPT = `You write page-1 copy for an Australian long-term rental appraisal aimed at property investors.

The page header already says "Long-term rental appraisal" — never use that phrase as the heading.

Inputs include the REA listing description, rent comparable range, and suburb statistics. Use them.

Rules:
- Australian English, confident but conservative — no hype, no guaranteed income.
- heading: one engaging line drawn from the listing (feature or positioning), not the street address alone.
- Blurbs: rewrite listing_description; weave in how rent sits vs the suburb without dollar amounts (range is in the sidebar). Provide three lengths per the contract — short (1 paragraph), medium (2 paragraphs), long (3 paragraphs). Each length must add detail; do not repeat the same paragraph across all three.
- bullets: exactly four short feature bullets drawn from the listing (layout, location, parking, amenities, etc.).
- Do not mention OpenAI or AI.
- Output valid JSON only with exactly the fields in the contract.`;

export type GenerateLeaseAppraisalCopyInput = {
  agency: Agency;
  listing: Listing;
  parsed: ParsedListing;
  compCount: number;
  weeklyMin: number | null;
  weeklyMax: number | null;
  suburbMarket?: LtrSuburbMarketJson | null;
  featuredComps?: LtrRentalCompCard[];
};

export async function generateLeaseAppraisalCopy(
  input: GenerateLeaseAppraisalCopyInput,
): Promise<LeaseAppraisalCopy> {
  const rentRangeLabel =
    input.weeklyMin != null && input.weeklyMax != null
      ? formatWeeklyRentRange(input.weeklyMin, input.weeklyMax)
      : "";

  const weeklyMid =
    input.parsed.rentalAppraisal?.weeklyMidpoint ??
    (input.weeklyMin != null && input.weeklyMax != null
      ? (input.weeklyMin + input.weeklyMax) / 2
      : null);

  const suburbMarket =
    input.suburbMarket ?? input.parsed.ltrSuburbMarket ?? null;

  const featuredComps =
    input.featuredComps ??
    input.parsed.rentalComps?.map((comp) => ({
      listing_id: comp.listingUrl ?? comp.address,
      name: comp.address,
      thumbnail_url: comp.imageUrl ?? "",
      listing_url: comp.listingUrl ?? "",
      bedrooms: comp.bedrooms ?? null,
      bathrooms: comp.bathrooms ?? null,
      weekly_rent: comp.weeklyRent,
      suburb: comp.suburb ?? null,
    })) ??
    [];

  const fallback = deriveLeaseAppraisalCopy({
    agency: input.agency,
    listing: input.listing,
    parsed: input.parsed,
    compCount: input.compCount,
    rentRangeLabel,
    weeklyMin: input.weeklyMin,
    weeklyMax: input.weeklyMax,
    weeklyMid,
    suburbMarket,
    featuredComps,
  });

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const payload = {
    property: {
      address: input.listing.property_address ?? input.parsed.address,
      suburb: input.listing.suburb ?? input.parsed.suburb,
      state: input.listing.state ?? input.parsed.state,
      postcode: input.listing.postcode ?? input.parsed.postcode,
      property_type: input.listing.property_type ?? input.parsed.propertyType,
      bedrooms: input.listing.bedrooms ?? input.parsed.bedrooms,
      bathrooms: input.listing.bathrooms ?? input.parsed.bathrooms,
      car_spaces: input.listing.car_spaces ?? input.parsed.carSpaces,
      listing_title: input.listing.listing_title ?? input.parsed.title,
      listing_description:
        input.listing.listing_description ?? input.parsed.description,
    },
    rent_appraisal: {
      weekly_min: input.weeklyMin,
      weekly_max: input.weeklyMax,
      weekly_mid: weeklyMid,
      comp_count: input.compCount,
      display_range: rentRangeLabel,
    },
    suburb_market: suburbMarket,
    featured_comps: featuredComps.map((comp) => ({
      address: comp.name,
      weekly_rent: comp.weekly_rent,
      bedrooms: comp.bedrooms,
      bathrooms: comp.bathrooms,
    })),
    agency: {
      name: input.agency.name,
      default_disclaimer: input.agency.default_disclaimer,
    },
    copy_limits: getPageOneMarketingCopyPromptLimits(),
    output_schema: PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  };

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: zodResponseFormat(
        pageOneMarketingCopyAiSchema,
        "lease_appraisal_copy",
      ),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${JSON.stringify(payload, null, 2)}\n\n${PAGE_ONE_MARKETING_COPY_JSON_CONTRACT}\n\n${getPageOneMarketingCopyPromptLimits()}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return fallback;
    }

    const parsed = pageOneMarketingCopyAiSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      console.error("Lease appraisal copy validation failed:", parsed.error.flatten());
      return fallback;
    }

    const pageOne = pageOneFromAiShape(parsed.data);

    return {
      ...fallback,
      heading: pageOne.heading,
      blurb: pageOneMediumBlurb(pageOne),
      blurb_variants: pageOne.blurb_variants,
      appeal_points: pageOne.bullets,
      key_metrics_line: "",
      supporting_factors: [],
      buyer_checks: fallback.buyer_checks,
      methodology_note: fallback.methodology_note,
      comparable_evidence: fallback.comparable_evidence,
      comparable_disclaimer:
        input.agency.default_disclaimer?.trim() ||
        fallback.comparable_disclaimer ||
        LEASE_APPRAISAL_COMPARABLE_DISCLAIMER,
      disclaimer: fallback.disclaimer,
      cta: input.agency.default_cta || fallback.cta,
    };
  } catch (error) {
    console.error("Lease appraisal copy generation failed:", error);
    return fallback;
  }
}
