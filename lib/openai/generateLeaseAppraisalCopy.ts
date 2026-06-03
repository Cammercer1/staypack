import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  deriveLeaseAppraisalCopy,
  type LeaseAppraisalCopy,
} from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import { isDevelopment } from "@/lib/env";
import { LEASE_APPRAISAL_COMPARABLE_DISCLAIMER } from "@/lib/lease-appraisal/comparableEvidenceCopy";
import type { Agency, Listing, LtrRentalCompCard, LtrSuburbMarketJson, ParsedListing } from "@/lib/types";

const leaseAppraisalCopySchema = z.object({
  heading: z.string(),
  blurb: z.string(),
  key_metrics_line: z.string(),
  appeal_points: z.array(z.string()).max(4),
  supporting_factors: z.array(z.string()).max(2),
  buyer_checks: z.array(z.string()).max(3),
  methodology_note: z.string(),
  disclaimer: z.string(),
  comparable_evidence: z.string(),
  comparable_disclaimer: z.string(),
});

const SYSTEM_PROMPT = `You write page-1 copy for an Australian long-term rental appraisal aimed at property investors.

The page header already says "Long-term rental appraisal" — never use that phrase as the heading.

Inputs include the REA listing description, rent comparable range, and suburb statistics. Use them.

Rules:
- Australian English, confident but conservative — no hype, no guaranteed income.
- heading: one engaging line drawn from the listing (feature or positioning), max 14 words. Not the street address alone.
- blurb: exactly 2–3 short paragraphs separated by blank lines:
  1) Property story from listing_description (rewrite, do not copy verbatim).
  2) How rent compares to the suburb — never state dollar amounts (the sidebar shows the range).
  3) Optional one sentence on suburb rental conditions (yield, vacancy, renters) if provided.
- key_metrics_line: always return an empty string "" (rent is shown separately in the layout).
- appeal_points: 3 bullets — each a DISTINCT fact (suburb stat, configuration, or investment angle). Never repeat the comp count if already in the blurb.
- supporting_factors: leave as empty array [].
- buyer_checks: 2 practical underwriting reminders.
- methodology_note: one sentence on REA comps + PropRadar suburb data.
- comparable_evidence: exactly 2 short paragraphs separated by a blank line for page 2 under comparable listing photos:
  1) How comps were reviewed (use comp_count and featured_comp_rents range), drivers of rent (views, building, parking, amenities, location near beach/light rail/suburb centre).
  2) Why the subject appraisal range is reasonable — reference subject features from listing_description and weekly_min/weekly_max with dollar amounts.
- comparable_disclaimer: use this exact text unless agency.default_disclaimer requires merging: "${LEASE_APPRAISAL_COMPARABLE_DISCLAIMER}"
- Do not mention OpenAI or AI.`;

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
  };

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: zodResponseFormat(leaseAppraisalCopySchema, "lease_appraisal_copy"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write copy:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return fallback;
    }

    const parsed = leaseAppraisalCopySchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      console.error("Lease appraisal copy validation failed:", parsed.error.flatten());
      return fallback;
    }

    return {
      ...parsed.data,
      key_metrics_line: "",
      supporting_factors: [],
      comparable_evidence:
        parsed.data.comparable_evidence.trim() || fallback.comparable_evidence,
      comparable_disclaimer:
        parsed.data.comparable_disclaimer.trim() || fallback.comparable_disclaimer,
      cta: input.agency.default_cta || fallback.cta,
    };
  } catch (error) {
    console.error("Lease appraisal copy generation failed:", error);
    return fallback;
  }
}
