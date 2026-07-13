import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { saleCompListingId } from "@/lib/sales-appraisal/saleCompIds";
import {
  roundSalePrice,
  type SalePriceBandResult,
} from "@/lib/sales/computeSalePriceBand";
import type { SaleAppraisalPositioning, ParsedListing } from "@/lib/types";
import type { SaleComp } from "@/lib/sales/types";

/**
 * Intelligence layer over the statistical REA sold-comp price band.
 *
 * Percentile filtering produces a defensible range but cannot weigh listing
 * quality, renovation level, or whether a comp is a poor match. This step asks
 * an LLM to set an estimated sale price range the way a listing agent would —
 * anchored to same-bedroom sold comps, with for-sale guides as context.
 */

const SYSTEM_PROMPT = `You are an Australian real estate agent preparing a sales appraisal for a vendor.

You receive the subject listing (for sale), a statistical sale price band from recently sold REA comparables, comp-anchor statistics, and individual comparable listings (each tagged "sold" with the sold price, or "for_sale" with the current price guide).

Your task: recommend a defensible estimated sale price range (AUD, whole dollars) for the subject if taken to market today.

How to weigh evidence:
- Recently SOLD same-bedroom comps in the same suburb are the primary anchor. comp_anchors.suggested_floor, suggested_target, and suggested_ceiling define a reasonable band — stay inside it unless listing quality clearly supports a premium.
- For-sale price guides are asking prices, not results — treat them as soft context only and never anchor the band to them.
- Use title, description, and property type for quality signals: renovations, views, parking, outdoor space, new development, premium finishes, land size.
- Ignore comps that are clearly inferior (fewer bathrooms, different property type, much cheaper fit-out) when setting the band — you may exclude them from featured_comp_indices.
- A premium renovated home may sit above the same-bedroom median sold price, but should not exceed the best credible same-bedroom sold result by more than ~8% unless multiple strong comps support it.
- Stay measured — you cannot observe buyer demand or campaign quality.

Calibration rules:
- Default near suggested_target when evidence is mixed.
- price_min <= price_midpoint <= price_max.
- Keep the band reasonably tight (typically within ~10–15% spread) unless comps genuinely span a wide range.
- Do not go below the weakest credible same-bedroom sold result unless the subject is clearly inferior.

Output JSON with:
- price_min, price_max, price_midpoint: integer AUD sale prices
- confidence: "low" | "medium" | "high"
- rationale: 1-2 plain-English sentences explaining the range. Mention concrete comps/evidence. Do not mention percentiles, REA, or OpenAI.
- featured_comp_indices: up to 6 indices (0-based) into comparable_listings for the best evidence comps to show the vendor. Prefer recently sold, same-bedroom, same-suburb matches; a strong for-sale guide may be included.`;

const positioningAiSchema = z.object({
  price_min: z.number(),
  price_max: z.number(),
  price_midpoint: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
  featured_comp_indices: z.array(z.number().int().min(0)).max(6),
});

export type SaleCompAnchors = {
  subject_bedrooms: number | null;
  same_bed_count: number;
  same_bed_min: number | null;
  same_bed_median: number | null;
  same_bed_p75: number | null;
  same_bed_max: number | null;
  all_comp_median: number | null;
  suggested_floor: number | null;
  suggested_ceiling: number | null;
  suggested_target: number | null;
};

export type PositionSalesAppraisalSubject = {
  property_address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  car_spaces: number | null;
  listing_title: string | null;
  listing_description: string | null;
  display_price: string | null;
  land_area_sqm: number | null;
  premium_tier: boolean;
};

export type PositionSalesAppraisalInput = {
  subject: PositionSalesAppraisalSubject;
  band: SalePriceBandResult;
  comps: SaleComp[];
};

export type PositionSalesAppraisalResult = {
  band: SalePriceBandResult;
  positioning: SaleAppraisalPositioning | null;
  selectedCompListingIds: string[] | null;
};

export const MIN_COMPS_FOR_SALE_POSITIONING = 5;
const MAX_DESCRIPTION_CHARS = 1500;
const SAME_BED_PREMIUM_CAP = 1.08;
const PREMIUM_SAME_BED_CAP = 1.12;

function percentileOfSorted(sorted: number[], percentile: number) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;

  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex]!;
  }

  const weight = index - lowerIndex;
  return (
    sorted[lowerIndex]! +
    (sorted[upperIndex]! - sorted[lowerIndex]!) * weight
  );
}

/** Anchors from sold comps only — for-sale guides are asking prices, not evidence. */
export function buildSaleCompAnchors(
  comps: SaleComp[],
  subjectBedrooms: number | null,
  premiumTier: boolean,
): SaleCompAnchors {
  const soldComps = comps.filter((comp) => comp.saleStatus === "sold");
  const allPrices = soldComps
    .map((comp) => comp.price)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  const sameBedPrices =
    subjectBedrooms == null
      ? []
      : soldComps
          .filter((comp) => comp.bedrooms === subjectBedrooms)
          .map((comp) => comp.price)
          .filter((value) => Number.isFinite(value) && value > 0)
          .sort((left, right) => left - right);

  const sameBedMin = sameBedPrices.length > 0 ? sameBedPrices[0]! : null;
  const sameBedMedian = percentileOfSorted(sameBedPrices, 0.5);
  const sameBedP75 = percentileOfSorted(sameBedPrices, 0.75);
  const sameBedMax =
    sameBedPrices.length > 0 ? sameBedPrices[sameBedPrices.length - 1]! : null;

  const bounds = deriveSaleCompAwareBounds({
    sameBedCount: sameBedPrices.length,
    sameBedMin,
    sameBedMedian,
    sameBedP75,
    sameBedMax,
    premiumTier,
    statisticalMid: percentileOfSorted(allPrices, 0.5),
  });

  return {
    subject_bedrooms: subjectBedrooms,
    same_bed_count: sameBedPrices.length,
    same_bed_min: sameBedMin,
    same_bed_median:
      sameBedMedian != null ? roundSalePrice(sameBedMedian) : null,
    same_bed_p75: sameBedP75 != null ? roundSalePrice(sameBedP75) : null,
    same_bed_max: sameBedMax != null ? roundSalePrice(sameBedMax) : null,
    all_comp_median: percentileOfSorted(allPrices, 0.5),
    suggested_floor: bounds.floor,
    suggested_ceiling: bounds.ceiling,
    suggested_target: bounds.target,
  };
}

export function deriveSaleCompAwareBounds({
  sameBedCount,
  sameBedMin,
  sameBedMedian,
  sameBedP75,
  sameBedMax,
  premiumTier,
  statisticalMid,
}: {
  sameBedCount: number;
  sameBedMin: number | null;
  sameBedMedian: number | null;
  sameBedP75: number | null;
  sameBedMax: number | null;
  premiumTier: boolean;
  statisticalMid: number | null;
}): { floor: number | null; ceiling: number | null; target: number | null } {
  if (sameBedCount >= 3 && sameBedMax != null && sameBedMedian != null) {
    const premiumCap = premiumTier ? PREMIUM_SAME_BED_CAP : SAME_BED_PREMIUM_CAP;
    const hardCeiling = roundSalePrice(sameBedMax * premiumCap);
    const softCeiling =
      sameBedP75 != null
        ? roundSalePrice(sameBedP75 * 1.08)
        : hardCeiling;
    const ceiling = Math.min(softCeiling, hardCeiling);
    const floor = roundSalePrice(
      Math.max(
        sameBedMin != null ? sameBedMin * 0.95 : sameBedMedian * 0.9,
        sameBedMedian * 0.9,
      ),
    );
    const target = roundSalePrice(
      sameBedMedian + (sameBedMax - sameBedMedian) * (premiumTier ? 0.6 : 0.5),
    );

    return { floor, ceiling, target };
  }

  if (statisticalMid != null) {
    return {
      floor: roundSalePrice(statisticalMid * 0.85),
      ceiling: roundSalePrice(statisticalMid * 1.15),
      target: roundSalePrice(statisticalMid),
    };
  }

  return { floor: null, ceiling: null, target: null };
}

function capPositionedBandWidth(
  band: SalePriceBandResult,
  maxSpreadPct = 0.15,
): SalePriceBandResult {
  const mid = band.priceMidpoint;
  if (mid <= 0) {
    return band;
  }

  const halfSpread = mid * (maxSpreadPct / 2);
  const cappedMin = roundSalePrice(Math.max(band.priceMin, mid - halfSpread));
  const cappedMax = roundSalePrice(Math.min(band.priceMax, mid + halfSpread));
  const priceMin = Math.min(cappedMin, cappedMax);
  const priceMax = Math.max(cappedMin, cappedMax);

  if (priceMin === band.priceMin && priceMax === band.priceMax) {
    return band;
  }

  return {
    ...band,
    priceMin,
    priceMax,
    priceMidpoint: roundSalePrice((priceMin + priceMax) / 2),
  };
}

export function normalizePositionedSaleBand(input: {
  priceMin: number;
  priceMax: number;
  priceMidpoint: number;
}): SalePriceBandResult {
  const values = [
    roundSalePrice(input.priceMin),
    roundSalePrice(input.priceMidpoint),
    roundSalePrice(input.priceMax),
  ].sort((left, right) => left - right);

  return capPositionedBandWidth(
    {
      priceMin: values[0]!,
      priceMidpoint: values[1]!,
      priceMax: values[2]!,
      compCount: 0,
    },
    0.15,
  );
}

export function clampPositionedSaleBand(
  llmBand: { priceMin: number; priceMax: number; priceMidpoint: number },
  anchors: SaleCompAnchors,
): { band: SalePriceBandResult; wasClamped: boolean } {
  let wasClamped = false;
  let priceMin = roundSalePrice(llmBand.priceMin);
  let priceMax = roundSalePrice(llmBand.priceMax);
  let priceMidpoint = roundSalePrice(llmBand.priceMidpoint);

  const { suggested_floor: floor, suggested_ceiling: ceiling } = anchors;

  if (floor != null && priceMin < floor) {
    priceMin = floor;
    wasClamped = true;
  }

  if (ceiling != null && priceMax > ceiling) {
    priceMax = ceiling;
    wasClamped = true;
  }

  if (floor != null && priceMidpoint < floor) {
    priceMidpoint = floor;
    wasClamped = true;
  }

  if (ceiling != null && priceMidpoint > ceiling) {
    priceMidpoint = ceiling;
    wasClamped = true;
  }

  const band = normalizePositionedSaleBand({
    priceMin,
    priceMax,
    priceMidpoint,
  });

  return { band, wasClamped };
}

function compForPrompt(comp: SaleComp, index: number) {
  return {
    index,
    address: comp.address,
    suburb: comp.suburb ?? null,
    price: comp.price,
    status: comp.saleStatus,
    sold_date: comp.soldDate ?? null,
    price_display: comp.priceDisplay ?? null,
    bedrooms: comp.bedrooms ?? null,
    bathrooms: comp.bathrooms ?? null,
    property_type: comp.propertyType ?? null,
  };
}

function resolveFeaturedCompIds(
  comps: SaleComp[],
  indices: number[] | undefined,
): string[] | null {
  if (!indices?.length) {
    return null;
  }

  const seen = new Set<SaleComp>();
  const ids: string[] = [];

  for (const index of indices) {
    const comp = comps[index];
    if (!comp || seen.has(comp)) {
      continue;
    }
    seen.add(comp);
    ids.push(saleCompListingId(comp, index));
    if (ids.length >= 6) {
      break;
    }
  }

  return ids.length > 0 ? ids : null;
}

export function saleSubjectFromParsedListing(
  listing: ParsedListing,
  premiumTier: boolean,
): PositionSalesAppraisalSubject {
  return {
    property_address: listing.address ?? null,
    suburb: listing.suburb ?? null,
    state: listing.state ?? null,
    postcode: listing.postcode ?? null,
    property_type: listing.propertyType ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    car_spaces: listing.carSpaces ?? null,
    listing_title: listing.title ?? null,
    listing_description: listing.description
      ? listing.description.slice(0, MAX_DESCRIPTION_CHARS)
      : null,
    display_price: listing.displayPrice ?? null,
    land_area_sqm: listing.landAreaSqm ?? null,
    premium_tier: premiumTier,
  };
}

export async function positionSalesAppraisal({
  subject,
  band,
  comps,
}: PositionSalesAppraisalInput): Promise<PositionSalesAppraisalResult> {
  const unpositioned: PositionSalesAppraisalResult = {
    band,
    positioning: null,
    selectedCompListingIds: null,
  };

  if (!process.env.OPENAI_API_KEY || comps.length < MIN_COMPS_FOR_SALE_POSITIONING) {
    return unpositioned;
  }

  const anchors = buildSaleCompAnchors(
    comps,
    subject.bedrooms,
    subject.premium_tier,
  );

  const payload = {
    subject,
    statistical_band: {
      price_min: band.priceMin,
      price_max: band.priceMax,
      price_midpoint: band.priceMidpoint,
      comp_count: band.compCount,
    },
    comp_anchors: anchors,
    comparable_listings: comps.map(compForPrompt),
  };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: zodResponseFormat(
        positioningAiSchema,
        "sales_appraisal_positioning",
      ),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return unpositioned;
    }

    const parsed = positioningAiSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      console.error(
        "Sales appraisal positioning returned invalid JSON:",
        parsed.error.flatten(),
      );
      return unpositioned;
    }

    const llmBand = {
      priceMin: roundSalePrice(parsed.data.price_min),
      priceMax: roundSalePrice(parsed.data.price_max),
      priceMidpoint: roundSalePrice(parsed.data.price_midpoint),
    };

    const { band: clampedBand, wasClamped } = clampPositionedSaleBand(
      llmBand,
      anchors,
    );

    const selectedCompListingIds = resolveFeaturedCompIds(
      comps,
      parsed.data.featured_comp_indices.length > 0
        ? parsed.data.featured_comp_indices
        : undefined,
    );

    return {
      band: {
        ...band,
        priceMin: clampedBand.priceMin,
        priceMax: clampedBand.priceMax,
        priceMidpoint: clampedBand.priceMidpoint,
      },
      positioning: {
        confidence: parsed.data.confidence,
        rationale: parsed.data.rationale,
        statistical_price_midpoint: band.priceMidpoint,
        llm_price_min: llmBand.priceMin,
        llm_price_max: llmBand.priceMax,
        llm_price_midpoint: llmBand.priceMidpoint,
        price_min: clampedBand.priceMin,
        price_max: clampedBand.priceMax,
        price_midpoint: clampedBand.priceMidpoint,
        was_clamped: wasClamped,
        comp_anchors: {
          same_bed_count: anchors.same_bed_count,
          same_bed_min: anchors.same_bed_min,
          same_bed_median: anchors.same_bed_median,
          same_bed_max: anchors.same_bed_max,
          suggested_floor: anchors.suggested_floor,
          suggested_ceiling: anchors.suggested_ceiling,
          suggested_target: anchors.suggested_target,
        },
      },
      selectedCompListingIds,
    };
  } catch (error) {
    console.error(
      "Sales appraisal positioning failed; using statistical band:",
      error instanceof Error ? error.message : error,
    );
    return unpositioned;
  }
}
