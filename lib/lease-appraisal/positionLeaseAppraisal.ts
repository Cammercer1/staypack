import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { rentalCompListingId } from "@/lib/lease-appraisal/rentalCompIds";
import { fillLeaseAppraisalCompSelection } from "@/lib/lease-appraisal/leaseAppraisalData";
import { formatWeeklyRentRange, type RentBandResult } from "@/lib/rental/computeRentBand";
import { filterRentalCompsForSubjectType } from "@/lib/rental/rankRentalCompsForSubject";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import type {
  LtrAppraisalPositioning,
  LtrSuburbMarketJson,
  ParsedListing,
} from "@/lib/types";
import type { RentalComp } from "@/lib/rental/types";

/**
 * Intelligence layer over the statistical REA rent band.
 *
 * REA discover returns a wide mix of stock; percentile filtering produces a
 * defensible range but cannot weigh listing quality, renovation level, or
 * whether a comp is a poor match. This step asks an LLM to set a weekly rent
 * band the way a leasing agent would — anchored to same-bedroom comps.
 */

const SYSTEM_PROMPT = `You are an Australian property manager preparing a long-term rental appraisal for an investor vendor.

You receive the subject listing (for sale), a statistical weekly rent band from REA comparables, comp-anchor statistics, individual rental listings, and optional suburb market data.

Your task: recommend a defensible weekly rent range (AUD, whole dollars) for the subject if leased on the open market today.

How to weigh evidence:
- Same-bedroom comps in the same suburb are the primary anchor. comp_anchors.suggested_floor, suggested_target, and suggested_ceiling define a reasonable band — stay inside it unless listing quality clearly supports a premium.
- Use title, description, and property type for quality signals: renovations, views, parking, outdoor space, new development, premium finishes, land size.
- Ignore comps that are clearly inferior (fewer bathrooms, different property type, much cheaper fit-out) when setting the band — you may exclude them from featured_comp_indices.
- A premium renovated home may sit above the same-bedroom median, but should not exceed the best credible same-bedroom comp by more than ~8% unless multiple strong comps support it.
- Stay measured — you cannot observe tenant demand or management quality.

Calibration rules:
- Default near suggested_target when evidence is mixed.
- weekly_min <= weekly_midpoint <= weekly_max.
- Keep the band reasonably tight (typically within ~15–20% spread) unless comps genuinely span a wide range.
- Do not chase suburb medians when individual same-bedroom comps are lower — trust the comp list.
- Do not go below the weakest credible same-bedroom comp unless the subject is clearly inferior.

Output JSON with:
- weekly_min, weekly_max, weekly_midpoint: integer AUD weekly rents
- confidence: "low" | "medium" | "high"
- rationale: 1-2 plain-English sentences explaining the range. Mention concrete comps/evidence. Do not mention percentiles, REA, or OpenAI.
- featured_comp_indices: up to 6 indices (0-based) into comparable_listings for the best evidence comps to show the vendor. Prefer same-bedroom, same-suburb, good-quality matches.`;

const positioningAiSchema = z.object({
  weekly_min: z.number(),
  weekly_max: z.number(),
  weekly_midpoint: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
  featured_comp_indices: z.array(z.number().int().min(0)).max(6),
});

export type RentCompAnchors = {
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

export type PositionLeaseAppraisalSubject = {
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

export type PositionLeaseAppraisalInput = {
  subject: PositionLeaseAppraisalSubject;
  band: RentBandResult;
  comps: RentalComp[];
  suburbMarket?: LtrSuburbMarketJson | null;
};

export type PositionLeaseAppraisalResult = {
  band: RentBandResult;
  positioning: LtrAppraisalPositioning | null;
  selectedCompListingIds: string[] | null;
};

export const MIN_COMPS_FOR_LEASE_POSITIONING = 5;
const MAX_DESCRIPTION_CHARS = 1500;
const SAME_BED_PREMIUM_CAP = 1.08;
const PREMIUM_SAME_BED_CAP = 1.12;

function roundWeeklyRent(value: number) {
  return Math.round(value / 5) * 5;
}

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

export function buildRentCompAnchors(
  comps: RentalComp[],
  subjectBedrooms: number | null,
  premiumTier: boolean,
): RentCompAnchors {
  const allRents = comps
    .map((comp) => comp.weeklyRent)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  const sameBedRents =
    subjectBedrooms == null
      ? []
      : comps
          .filter((comp) => comp.bedrooms === subjectBedrooms)
          .map((comp) => comp.weeklyRent)
          .filter((value) => Number.isFinite(value) && value > 0)
          .sort((left, right) => left - right);

  const sameBedMin = sameBedRents.length > 0 ? sameBedRents[0]! : null;
  const sameBedMedian = percentileOfSorted(sameBedRents, 0.5);
  const sameBedP75 = percentileOfSorted(sameBedRents, 0.75);
  const sameBedMax =
    sameBedRents.length > 0 ? sameBedRents[sameBedRents.length - 1]! : null;

  const bounds = deriveRentCompAwareBounds({
    sameBedCount: sameBedRents.length,
    sameBedMin,
    sameBedMedian,
    sameBedP75,
    sameBedMax,
    premiumTier,
    statisticalMid: percentileOfSorted(allRents, 0.5),
  });

  return {
    subject_bedrooms: subjectBedrooms,
    same_bed_count: sameBedRents.length,
    same_bed_min: sameBedMin,
    same_bed_median:
      sameBedMedian != null ? roundWeeklyRent(sameBedMedian) : null,
    same_bed_p75: sameBedP75 != null ? roundWeeklyRent(sameBedP75) : null,
    same_bed_max: sameBedMax != null ? roundWeeklyRent(sameBedMax) : null,
    all_comp_median: percentileOfSorted(allRents, 0.5),
    suggested_floor: bounds.floor,
    suggested_ceiling: bounds.ceiling,
    suggested_target: bounds.target,
  };
}

export function deriveRentCompAwareBounds({
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
    const hardCeiling = roundWeeklyRent(sameBedMax * premiumCap);
    const softCeiling =
      sameBedP75 != null
        ? roundWeeklyRent(sameBedP75 * 1.08)
        : hardCeiling;
    const statisticalCeiling = Math.min(softCeiling, hardCeiling);
    const floor = roundWeeklyRent(
      Math.max(
        sameBedMin != null ? sameBedMin * 0.95 : sameBedMedian * 0.9,
        sameBedMedian * 0.9,
      ),
    );
    const target = roundWeeklyRent(
      sameBedMedian + (sameBedMax - sameBedMedian) * (premiumTier ? 0.6 : 0.5),
    );
    const ceiling = Math.max(
      statisticalCeiling,
      target,
      premiumTier ? sameBedMax : 0,
    );

    return { floor, ceiling, target };
  }

  if (statisticalMid != null) {
    return {
      floor: roundWeeklyRent(statisticalMid * 0.85),
      ceiling: roundWeeklyRent(statisticalMid * 1.15),
      target: roundWeeklyRent(statisticalMid),
    };
  }

  return { floor: null, ceiling: null, target: null };
}

function capPositionedBandWidth(
  band: RentBandResult,
  maxSpreadPct = 0.22,
): RentBandResult {
  const mid = band.weeklyMidpoint;
  if (mid <= 0) {
    return band;
  }

  const halfSpread = mid * (maxSpreadPct / 2);
  const cappedMin = Math.round(Math.max(band.weeklyMin, mid - halfSpread));
  const cappedMax = Math.round(Math.min(band.weeklyMax, mid + halfSpread));
  const weeklyMin = Math.min(cappedMin, cappedMax);
  const weeklyMax = Math.max(cappedMin, cappedMax);

  if (weeklyMin === band.weeklyMin && weeklyMax === band.weeklyMax) {
    return band;
  }

  return {
    ...band,
    weeklyMin,
    weeklyMax,
    weeklyMidpoint: Math.round((weeklyMin + weeklyMax) / 2),
  };
}

export function normalizePositionedRentBand(input: {
  weeklyMin: number;
  weeklyMax: number;
  weeklyMidpoint: number;
}): RentBandResult {
  const values = [
    roundWeeklyRent(input.weeklyMin),
    roundWeeklyRent(input.weeklyMidpoint),
    roundWeeklyRent(input.weeklyMax),
  ].sort((left, right) => left - right);

  const weeklyMin = values[0]!;
  const weeklyMidpoint = values[1]!;
  const weeklyMax = values[2]!;

  return capPositionedBandWidth(
    {
      weeklyMin,
      weeklyMax,
      weeklyMidpoint,
      compCount: 0,
      featuredComps: [],
    },
    0.22,
  );
}

export function clampPositionedRentBand(
  llmBand: { weeklyMin: number; weeklyMax: number; weeklyMidpoint: number },
  anchors: RentCompAnchors,
): { band: RentBandResult; wasClamped: boolean } {
  let wasClamped = false;
  let weeklyMin = roundWeeklyRent(llmBand.weeklyMin);
  let weeklyMax = roundWeeklyRent(llmBand.weeklyMax);
  let weeklyMidpoint = roundWeeklyRent(llmBand.weeklyMidpoint);

  const { suggested_floor: floor, suggested_ceiling: ceiling } = anchors;

  if (floor != null && weeklyMin < floor) {
    weeklyMin = floor;
    wasClamped = true;
  }

  if (ceiling != null && weeklyMax > ceiling) {
    weeklyMax = ceiling;
    wasClamped = true;
  }

  if (floor != null && weeklyMidpoint < floor) {
    weeklyMidpoint = floor;
    wasClamped = true;
  }

  if (ceiling != null && weeklyMidpoint > ceiling) {
    weeklyMidpoint = ceiling;
    wasClamped = true;
  }

  const band = normalizePositionedRentBand({
    weeklyMin,
    weeklyMax,
    weeklyMidpoint,
  });

  return { band, wasClamped };
}

function compForPrompt(comp: RentalComp, index: number) {
  return {
    index,
    address: comp.address,
    suburb: comp.suburb ?? null,
    weekly_rent: comp.weeklyRent,
    bedrooms: comp.bedrooms ?? null,
    bathrooms: comp.bathrooms ?? null,
    property_type: comp.propertyType ?? null,
  };
}

function resolveFeaturedCompIds(
  comps: RentalComp[],
  indices: number[] | undefined,
): string[] | null {
  if (!indices?.length) {
    return null;
  }

  const seen = new Set<RentalComp>();
  const ids: string[] = [];

  for (const index of indices) {
    const comp = comps[index];
    if (!comp || seen.has(comp)) {
      continue;
    }
    seen.add(comp);
    ids.push(rentalCompListingId(comp, index));
    if (ids.length >= 6) {
      break;
    }
  }

  return ids.length > 0 ? ids : null;
}

export function subjectFromParsedListing(
  listing: ParsedListing,
  premiumTier: boolean,
): PositionLeaseAppraisalSubject {
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

/** Re-run LLM positioning on saved comps without a fresh REA scrape. */
export async function ensureLeaseAppraisalPositioning(
  parsed: ParsedListing,
): Promise<ParsedListing> {
  const appraisal = parsed.rentalAppraisal;
  const comps = filterRentalCompsForSubjectType(
    parsed.rentalComps ?? [],
    resolveRentSubjectPropertyType(parsed),
  );

  if (
    appraisal?.positioning ||
    appraisal?.weeklyMidpoint == null ||
    comps.length < MIN_COMPS_FOR_LEASE_POSITIONING
  ) {
    return parsed;
  }

  const band: RentBandResult = {
    weeklyMin: appraisal.weeklyMin ?? appraisal.weeklyMidpoint,
    weeklyMax: appraisal.weeklyMax ?? appraisal.weeklyMidpoint,
    weeklyMidpoint: appraisal.weeklyMidpoint,
    compCount: appraisal.compCount ?? comps.length,
    featuredComps: [],
  };

  const positioned = await positionLeaseAppraisal({
    subject: subjectFromParsedListing(parsed, appraisal.premiumTier ?? false),
    band,
    comps,
    suburbMarket: parsed.ltrSuburbMarket,
  });

  if (!positioned.positioning) {
    return parsed;
  }

  const selectedCompListingIds = fillLeaseAppraisalCompSelection(
    parsed,
    positioned.selectedCompListingIds ??
      parsed.rentalAppraisal?.selectedCompListingIds ??
      [],
  );

  return {
    ...parsed,
    displayPrice: formatWeeklyRentRange(
      positioned.band.weeklyMin,
      positioned.band.weeklyMax,
    ),
    rentalAppraisal: {
      ...appraisal,
      weeklyMin: positioned.band.weeklyMin,
      weeklyMax: positioned.band.weeklyMax,
      weeklyMidpoint: positioned.band.weeklyMidpoint,
      selectedCompListingIds,
      positioning: {
        ...positioned.positioning,
        statistical_weekly_midpoint: band.weeklyMidpoint,
      },
    },
  };
}

export async function positionLeaseAppraisal({
  subject,
  band,
  comps,
  suburbMarket,
}: PositionLeaseAppraisalInput): Promise<PositionLeaseAppraisalResult> {
  const unpositioned: PositionLeaseAppraisalResult = {
    band,
    positioning: null,
    selectedCompListingIds: null,
  };

  if (!process.env.OPENAI_API_KEY || comps.length < MIN_COMPS_FOR_LEASE_POSITIONING) {
    return unpositioned;
  }

  const anchors = buildRentCompAnchors(
    comps,
    subject.bedrooms,
    subject.premium_tier,
  );

  const payload = {
    subject,
    statistical_band: {
      weekly_min: band.weeklyMin,
      weekly_max: band.weeklyMax,
      weekly_midpoint: band.weeklyMidpoint,
      comp_count: band.compCount,
    },
    comp_anchors: anchors,
    comparable_listings: comps.map(compForPrompt),
    suburb_market: suburbMarket ?? null,
  };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: zodResponseFormat(
        positioningAiSchema,
        "lease_appraisal_positioning",
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
        "Lease appraisal positioning returned invalid JSON:",
        parsed.error.flatten(),
      );
      return unpositioned;
    }

    const llmBand = {
      weeklyMin: roundWeeklyRent(parsed.data.weekly_min),
      weeklyMax: roundWeeklyRent(parsed.data.weekly_max),
      weeklyMidpoint: roundWeeklyRent(parsed.data.weekly_midpoint),
    };

    const { band: clampedBand, wasClamped } = clampPositionedRentBand(
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
        weeklyMin: clampedBand.weeklyMin,
        weeklyMax: clampedBand.weeklyMax,
        weeklyMidpoint: clampedBand.weeklyMidpoint,
      },
      positioning: {
        confidence: parsed.data.confidence,
        rationale: parsed.data.rationale,
        statistical_weekly_midpoint: band.weeklyMidpoint,
        llm_weekly_min: llmBand.weeklyMin,
        llm_weekly_max: llmBand.weeklyMax,
        llm_weekly_midpoint: llmBand.weeklyMidpoint,
        weekly_min: clampedBand.weeklyMin,
        weekly_max: clampedBand.weeklyMax,
        weekly_midpoint: clampedBand.weeklyMidpoint,
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
      "Lease appraisal positioning failed; using statistical band:",
      error instanceof Error ? error.message : error,
    );
    return unpositioned;
  }
}
