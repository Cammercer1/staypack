import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  deriveSalesAppraisalCopy,
  type SalesAppraisalCopy,
} from "@/lib/sales-appraisal/deriveSalesAppraisalCopy";
import { formatSalePriceRange } from "@/lib/sales/computeSalePriceBand";
import { SALES_APPRAISAL_COMPARABLE_DISCLAIMER } from "@/lib/sales-appraisal/comparableEvidenceCopy";
import { reportableSaleLandArea } from "@/lib/sales/reportableSaleArea";
import {
  PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  PAGE_ONE_COPY_MAX_ATTEMPTS,
  buildPageOneCopyRepairPrompt,
  getPageOneMarketingCopyPromptLimits,
  pageOneFromAiShape,
  pageOneMediumBlurb,
  pageOneMarketingCopyAiSchema,
} from "@/lib/copy/pageOneMarketingCopy";
import type { Agency, Listing, ParsedListing, SaleCompCard } from "@/lib/types";

const SYSTEM_PROMPT = `You write page-1 copy for an Australian sales appraisal aimed at property vendors.

The page header already says "Property appraisal" — never use that phrase as the heading.

Inputs include the REA listing description, recently sold comparable evidence, current for-sale price guides, and an estimated sale price range. Use them.

Rules:
- Australian English, confident but conservative — no hype, no guaranteed prices.
- heading: one engaging line drawn from the listing (feature or positioning), not the street address alone.
- Blurbs: rewrite listing_description; weave in how the home sits against recent sold results without dollar amounts (the range is in the sidebar). Provide three lengths per the contract — short (1 paragraph), medium (2 paragraphs), long (3 paragraphs). Each length must add detail; do not repeat the same paragraph across all three.
- bullets: exactly four short feature bullets drawn from the listing (layout, location, parking, amenities, etc.).
- Do not mention OpenAI or AI.
- Character limits in copy_limits are strict maximums. Stay under every limit — over-limit responses are rejected and rewritten.
- Output valid JSON only with exactly the fields in the contract.`;

export type GenerateSalesAppraisalCopyInput = {
  agency: Agency;
  listing: Listing;
  parsed: ParsedListing;
  soldCompCount: number;
  forSaleCompCount: number;
  priceMin: number | null;
  priceMax: number | null;
  featuredComps?: SaleCompCard[];
};

export async function generateSalesAppraisalCopy(
  input: GenerateSalesAppraisalCopyInput,
): Promise<SalesAppraisalCopy> {
  const priceRangeLabel =
    input.priceMin != null && input.priceMax != null
      ? formatSalePriceRange(input.priceMin, input.priceMax)
      : "";

  const featuredComps =
    input.featuredComps ??
    input.parsed.salesComps?.map((comp) => ({
      listing_id: comp.listingUrl ?? comp.address,
      name: comp.address,
      thumbnail_url: comp.imageUrl ?? "",
      listing_url: comp.listingUrl ?? "",
      bedrooms: comp.bedrooms ?? null,
      bathrooms: comp.bathrooms ?? null,
      car_spaces: comp.carSpaces ?? null,
      property_type: comp.propertyType ?? null,
      price: comp.price,
      price_display: comp.priceDisplay ?? null,
      sale_status: comp.saleStatus,
      sold_date: comp.soldDate ?? null,
      land_area_sqm: reportableSaleLandArea(
        comp.propertyType,
        comp.landAreaSqm,
      ),
      floor_area_sqm: comp.floorAreaSqm ?? null,
      suburb: comp.suburb ?? null,
    })) ??
    [];

  const fallback = deriveSalesAppraisalCopy({
    agency: input.agency,
    listing: input.listing,
    parsed: input.parsed,
    soldCompCount: input.soldCompCount,
    forSaleCompCount: input.forSaleCompCount,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
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
      land_area_sqm: input.parsed.landAreaSqm ?? null,
      floor_area_sqm: input.parsed.floorAreaSqm ?? null,
    },
    sale_appraisal: {
      price_min: input.priceMin,
      price_max: input.priceMax,
      sold_comp_count: input.soldCompCount,
      for_sale_comp_count: input.forSaleCompCount,
      display_range: priceRangeLabel,
    },
    featured_comps: featuredComps.map((comp) => ({
      address: comp.name,
      price: comp.price,
      status: comp.sale_status,
      sold_date: comp.sold_date,
      land_area_sqm: comp.land_area_sqm,
      floor_area_sqm: comp.floor_area_sqm,
      bedrooms: comp.bedrooms,
      bathrooms: comp.bathrooms,
      car_spaces: comp.car_spaces,
      property_type: comp.property_type,
    })),
    agency: {
      name: input.agency.name,
      default_disclaimer: input.agency.default_disclaimer,
    },
    copy_limits: getPageOneMarketingCopyPromptLimits(),
    output_schema: PAGE_ONE_MARKETING_COPY_JSON_CONTRACT,
  };

  try {
    let raw: unknown = null;
    let validationErrors: unknown = null;

    for (let attempt = 0; attempt < PAGE_ONE_COPY_MAX_ATTEMPTS; attempt += 1) {
      const response = await client.chat.completions.create({
        model: "gpt-5.4-mini",
        response_format: zodResponseFormat(
          pageOneMarketingCopyAiSchema,
          "sales_appraisal_copy",
        ),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              attempt === 0
                ? `${JSON.stringify(payload, null, 2)}\n\n${PAGE_ONE_MARKETING_COPY_JSON_CONTRACT}\n\n${getPageOneMarketingCopyPromptLimits()}`
                : buildPageOneCopyRepairPrompt(payload, raw, validationErrors),
          },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        break;
      }

      raw = JSON.parse(text);
      const parsedAttempt = pageOneMarketingCopyAiSchema.safeParse(raw);
      if (parsedAttempt.success) {
        const pageOne = pageOneFromAiShape(parsedAttempt.data);

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
            SALES_APPRAISAL_COMPARABLE_DISCLAIMER,
          disclaimer: fallback.disclaimer,
          cta: input.agency.default_cta || fallback.cta,
        };
      }

      validationErrors = parsedAttempt.error.flatten();
      console.error(
        `Sales appraisal copy validation failed (attempt ${attempt + 1}/${PAGE_ONE_COPY_MAX_ATTEMPTS}):`,
        validationErrors,
      );
    }

    return fallback;
  } catch (error) {
    console.error("Sales appraisal copy generation failed:", error);
    return fallback;
  }
}
