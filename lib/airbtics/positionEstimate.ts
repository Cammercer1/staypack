import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import type { StrEstimate, StrEstimatePositioning } from "@/lib/types";
import { filterEntireHomeComps } from "@/lib/airbtics/compFilters";

/**
 * Intelligence layer over the raw Airbtics estimate.
 *
 * Airbtics returns a revenue distribution (p25/p50/p75/p90) for a generic
 * bed/bath config at the subject's coordinates. The median is a blend of all
 * nearby comps — old walk-ups and luxury towers alike — so a premium unit in a
 * new building gets understated when weak nearby stock drags the median down.
 *
 * This step asks an LLM to pick a defensible annual gross revenue using the
 * subject listing, same-bedroom comp evidence, and the Airbtics KPI curve.
 * Post-validation clamps the LLM output to a comp-derived band so page-1
 * headline revenue stays consistent with page-2 comparable listings.
 */

const SYSTEM_PROMPT = `You are a short-term rental (STR) underwriting analyst for Australian property.

You are given a subject property, Airbtics market percentile KPIs (p25–p90), comp-anchor statistics for same-bedroom listings, and individual comparable listings.

Your task: pick one annual gross revenue figure (AUD, whole dollars) that the subject would most likely achieve based on the evidence.

How to weigh evidence:
- Same-bedroom comps are the primary anchor. The suggested_floor, suggested_target, and suggested_ceiling in comp_anchors define a reasonable band — stay inside it unless you have very strong same-building evidence.
- Comps under ~75m are often in the same building or complex. Same-building comps with the same bedroom count are the strongest evidence.
- Use quality_signals plus the listing title/description and price for property quality: new development, premium finishes, ocean/water views, floor level, renovations, or obvious weakness.
- A premium new build may sit above the same-bedroom median, but should not exceed the best nearby same-bedroom comp by more than a modest premium unless same-building comps support it.
- Revenue depends on management quality, which you cannot observe. Stay measured.

Calibration rules:
- Default near suggested_target when evidence is mixed.
- Only go above the same-bedroom p75 when quality signals AND nearby same-bedroom comps support it.
- Do not chase the Airbtics KPI p75/p90 when individual same-bedroom comps are materially lower — trust the comp list for the headline figure.
- Do not go below the weakest credible same-bedroom comp unless the subject is clearly inferior (dated, poor layout, no appeal).

Output JSON with:
- annual_revenue: integer AUD annual gross revenue
- confidence: "low" | "medium" | "high"
- rationale: 1-2 plain-English sentences explaining the figure. Mention concrete comps/evidence. Do not mention percentiles, Airbtics, or OpenAI.`;

const positioningAiSchema = z.object({
  annual_revenue: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
});

export type PercentileKpiPoint = {
  percentile: number;
  revenue: number;
  nightlyRate: number | null;
  occupancyRate: number | null;
};

export type PositionEstimateSubject = {
  property_address: string | null;
  suburb: string | null;
  state: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  listing_title: string | null;
  listing_description: string | null;
  display_price: string | null;
  quality_signals?: string[];
};

export type PositionEstimateResult = {
  estimate: StrEstimate;
  positioning: StrEstimatePositioning | null;
};

export type CompAnchors = {
  subject_bedrooms: number | null;
  same_bed_count: number;
  same_bed_min: number | null;
  same_bed_median: number | null;
  same_bed_p75: number | null;
  same_bed_max: number | null;
  nearby_same_bed_max: number | null;
  all_comp_median: number | null;
  all_comp_max: number | null;
  kpi_p25: number | null;
  kpi_p50: number | null;
  kpi_p75: number | null;
  kpi_p90: number | null;
  suggested_floor: number | null;
  suggested_ceiling: number | null;
  /** Calibrated midpoint between same-bedroom median and best comp. */
  suggested_target: number | null;
};

const PERCENTILE_KEYS = ["25", "50", "75", "90"] as const;
export const MIN_POSITIONING_PERCENTILE = 25;
export const MAX_POSITIONING_PERCENTILE = 90;
/** Don't try to outsmart the median without a meaningful comp set. */
export const MIN_COMPS_FOR_POSITIONING = 5;
const MAX_DESCRIPTION_CHARS = 1500;
/** Max uplift over best same-bedroom comp without same-building evidence. */
const SAME_BED_PREMIUM_CAP = 1.08;
/** Max uplift when a very nearby same-bedroom comp supports premium positioning. */
const NEARBY_SAME_BED_PREMIUM_CAP = 1.15;
const NEARBY_SAME_BED_DISTANCE_M = 120;
const PROMPT_COMP_LIMIT = 18;

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundRevenue(value: number) {
  return Math.round(value);
}

function unwrapRawEnvelope(raw: Record<string, unknown>) {
  if (raw.message && typeof raw.message === "object") {
    return raw.message as Record<string, unknown>;
  }

  return raw;
}

export function extractPercentileKpis(raw: unknown): PercentileKpiPoint[] {
  if (!raw || typeof raw !== "object") return [];

  const message = unwrapRawEnvelope(raw as Record<string, unknown>);
  const kpis = message.kpis as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!kpis) return [];

  const points: PercentileKpiPoint[] = [];
  for (const key of PERCENTILE_KEYS) {
    const kpi = kpis[key];
    const revenue = numberOrNull(kpi?.ltm_revenue);
    if (revenue == null) continue;
    points.push({
      percentile: Number(key),
      revenue,
      nightlyRate: numberOrNull(kpi?.ltm_nightly_rate),
      occupancyRate: numberOrNull(kpi?.ltm_occupancy_rate),
    });
  }

  return points;
}

export function clampPercentile(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(
    MAX_POSITIONING_PERCENTILE,
    Math.max(MIN_POSITIONING_PERCENTILE, Math.round(value)),
  );
}

function percentileOfSorted(sorted: number[], percentile: number) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];

  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
}

type RawComp = Record<string, unknown>;

export function extractComps(raw: unknown): RawComp[] {
  if (!raw || typeof raw !== "object") return [];

  const message = unwrapRawEnvelope(raw as Record<string, unknown>);
  return Array.isArray(message.comps)
    ? filterEntireHomeComps(message.comps as RawComp[])
    : [];
}

function compAnnualRevenue(comp: RawComp) {
  return numberOrNull(comp.annual_revenue_ltm ?? comp.annual_revenue);
}

function compBedrooms(comp: RawComp) {
  return numberOrNull(comp.bedrooms);
}

function compDistance(comp: RawComp) {
  return numberOrNull(comp.distance);
}

function compOccupancyRate(comp: RawComp) {
  return numberOrNull(comp.avg_occupancy_rate_ltm ?? comp.occupancy_rate);
}

function compForPrompt(comp: RawComp) {
  return {
    name: String(comp.name ?? "Comparable listing"),
    distance_m: compDistance(comp),
    bedrooms: compBedrooms(comp),
    bathrooms: numberOrNull(comp.bathrooms),
    annual_revenue: compAnnualRevenue(comp),
    nightly_rate: numberOrNull(
      comp.avg_booked_daily_rate_ltm ?? comp.nightly_rate,
    ),
    occupancy_rate: numberOrNull(
      comp.avg_occupancy_rate_ltm ?? comp.occupancy_rate,
    ),
    similarity_score: numberOrNull(comp.similarity_score),
  };
}

type QualitySignalRule = {
  label: string;
  patterns: RegExp[];
};

const POSITIVE_QUALITY_SIGNAL_RULES: QualitySignalRule[] = [
  {
    label: "water or coastal view / position",
    patterns: [
      /\b(ocean|water|river|canal|harbou?r|beach|coastal|sea)\s+(view|views|front|frontage|facing)\b/i,
      /\bbeachfront\b/i,
      /\bwaterfront\b/i,
    ],
  },
  {
    label: "walkable beach or lifestyle location",
    patterns: [
      /\bwalk(?:ing)?\s+(?:distance\s+)?to\s+(?:the\s+)?(beach|shops|cafes|cafés|restaurants|dining|cbd|town centre|transport)\b/i,
      /\bminutes?\s+(?:walk|to)\s+(?:the\s+)?(beach|shops|cafes|cafés|restaurants|dining|cbd|town centre|transport)\b/i,
    ],
  },
  {
    label: "new, renovated or premium presentation",
    patterns: [
      /\b(new|brand new|near new|newly built|new build|renovated|fully renovated|recently renovated|refurbished)\b/i,
      /\b(luxury|premium|high[-\s]?end|designer|architectural|bespoke|executive)\b/i,
    ],
  },
  {
    label: "strong outdoor amenity",
    patterns: [
      /\b(pool|swimming pool|spa|hot tub)\b/i,
      /\b(balcony|terrace|alfresco|outdoor entertaining|entertaining deck|courtyard)\b/i,
    ],
  },
  {
    label: "parking or easy access",
    patterns: [
      /\b(secure parking|garage|car space|carport|off[-\s]?street parking|lift access|elevator)\b/i,
    ],
  },
  {
    label: "comfort features",
    patterns: [/\b(air[-\s]?conditioning|ducted air|ceiling fans|heating)\b/i],
  },
  {
    label: "family or group-friendly layout",
    patterns: [
      /\b(multiple living|second living|media room|rumpus|family room|open[-\s]?plan)\b/i,
      /\b(large|spacious|generous)\s+(home|apartment|unit|townhouse|living|bedrooms)\b/i,
    ],
  },
];

const NEGATIVE_QUALITY_SIGNAL_RULES: QualitySignalRule[] = [
  {
    label: "dated or basic presentation risk",
    patterns: [
      /\b(original condition|dated|basic|tired|needs work|renovator|renovation required|unrenovated)\b/i,
    ],
  },
  {
    label: "reduced amenity warning",
    patterns: [
      /\b(no parking|street parking only|no air[-\s]?conditioning|walk[-\s]?up)\b/i,
    ],
  },
];

export function extractStrQualitySignals({
  title,
  description,
  propertyType,
}: {
  title?: string | null;
  description?: string | null;
  propertyType?: string | null;
}): string[] {
  const text = [title, description].filter(Boolean).join("\n").slice(0, 6000);
  const signals: string[] = [];

  const addMatches = (rules: QualitySignalRule[], prefix?: string) => {
    for (const rule of rules) {
      if (rule.patterns.some((pattern) => pattern.test(text))) {
        signals.push(prefix ? `${prefix}: ${rule.label}` : rule.label);
      }
    }
  };

  addMatches(POSITIVE_QUALITY_SIGNAL_RULES);
  addMatches(NEGATIVE_QUALITY_SIGNAL_RULES, "caution");

  if (propertyType && /\b(penthouse|villa|duplex|townhouse)\b/i.test(propertyType)) {
    signals.push(`property type signal: ${propertyType}`);
  }

  return [...new Set(signals)].slice(0, 10);
}

function uniqueCompKey(comp: RawComp) {
  return String(
    comp.listingID ??
      comp.listing_id ??
      comp.listing_url ??
      comp.name ??
      JSON.stringify(compForPrompt(comp)),
  );
}

function byDistance(left: RawComp, right: RawComp) {
  return (compDistance(left) ?? Number.MAX_SAFE_INTEGER) -
    (compDistance(right) ?? Number.MAX_SAFE_INTEGER);
}

function byAnnualRevenueDesc(left: RawComp, right: RawComp) {
  return (compAnnualRevenue(right) ?? 0) - (compAnnualRevenue(left) ?? 0);
}

function bySimilarityDesc(left: RawComp, right: RawComp) {
  return Number(right.similarity_score ?? 0) - Number(left.similarity_score ?? 0);
}

export function selectPromptComps(
  comps: RawComp[],
  subjectBedrooms: number | null,
  limit = PROMPT_COMP_LIMIT,
): RawComp[] {
  const selected: RawComp[] = [];
  const seen = new Set<string>();
  const sameBed =
    subjectBedrooms == null
      ? []
      : comps.filter((comp) => compBedrooms(comp) === subjectBedrooms);
  const nearby = comps.filter((comp) => {
    const distance = compDistance(comp);
    return distance != null && distance <= NEARBY_SAME_BED_DISTANCE_M;
  });

  const add = (candidate: RawComp | undefined) => {
    if (!candidate || selected.length >= limit) {
      return;
    }

    const key = uniqueCompKey(candidate);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    selected.push(candidate);
  };

  for (const comp of [...sameBed].sort(byDistance).slice(0, 6)) add(comp);
  for (const comp of [...sameBed].sort(byAnnualRevenueDesc).slice(0, 6)) add(comp);
  for (const comp of [...sameBed].sort(bySimilarityDesc).slice(0, 6)) add(comp);
  for (const comp of [...nearby].sort(byDistance).slice(0, 4)) add(comp);
  for (const comp of [...comps].sort(bySimilarityDesc).slice(0, 6)) add(comp);
  for (const comp of [...comps].sort(byAnnualRevenueDesc).slice(0, 4)) add(comp);
  for (const comp of [...comps].sort(byDistance).slice(0, 4)) add(comp);

  return selected;
}

export function buildCompAnchors(
  comps: RawComp[],
  subjectBedrooms: number | null,
  kpiPoints: PercentileKpiPoint[],
): CompAnchors {
  const allRevenues = comps
    .map(compAnnualRevenue)
    .filter((value): value is number => value != null && value > 0)
    .sort((left, right) => left - right);

  const sameBedRevenues =
    subjectBedrooms == null
      ? []
      : comps
          .filter((comp) => compBedrooms(comp) === subjectBedrooms)
          .map(compAnnualRevenue)
          .filter((value): value is number => value != null && value > 0)
          .sort((left, right) => left - right);

  const nearbySameBedMax =
    subjectBedrooms == null
      ? null
      : comps.reduce<number | null>((best, comp) => {
          if (compBedrooms(comp) !== subjectBedrooms) {
            return best;
          }

          const distance = compDistance(comp);
          const revenue = compAnnualRevenue(comp);
          if (
            distance == null ||
            distance > NEARBY_SAME_BED_DISTANCE_M ||
            revenue == null
          ) {
            return best;
          }

          return best == null ? revenue : Math.max(best, revenue);
        }, null);

  const kpiP50 =
    kpiPoints.find((point) => point.percentile === 50)?.revenue ?? null;
  const kpiP25 =
    kpiPoints.find((point) => point.percentile === 25)?.revenue ?? null;
  const kpiP75 =
    kpiPoints.find((point) => point.percentile === 75)?.revenue ?? null;
  const kpiP90 =
    kpiPoints.find((point) => point.percentile === 90)?.revenue ?? null;

  const sameBedMedian = percentileOfSorted(sameBedRevenues, 0.5);
  const sameBedP75 = percentileOfSorted(sameBedRevenues, 0.75);
  const sameBedMax =
    sameBedRevenues.length > 0
      ? sameBedRevenues[sameBedRevenues.length - 1]
      : null;
  const sameBedMin = sameBedRevenues.length > 0 ? sameBedRevenues[0] : null;

  const bounds = deriveCompAwareBounds({
    sameBedCount: sameBedRevenues.length,
    sameBedMin,
    sameBedMedian,
    sameBedP75,
    sameBedMax,
    nearbySameBedMax,
    kpiP25,
    kpiP50,
    kpiP75,
    kpiP90,
  });

  return {
    subject_bedrooms: subjectBedrooms,
    same_bed_count: sameBedRevenues.length,
    same_bed_min: sameBedMin,
    same_bed_median: sameBedMedian != null ? roundRevenue(sameBedMedian) : null,
    same_bed_p75: sameBedP75 != null ? roundRevenue(sameBedP75) : null,
    same_bed_max: sameBedMax != null ? roundRevenue(sameBedMax) : null,
    nearby_same_bed_max:
      nearbySameBedMax != null ? roundRevenue(nearbySameBedMax) : null,
    all_comp_median: percentileOfSorted(allRevenues, 0.5),
    all_comp_max:
      allRevenues.length > 0 ? allRevenues[allRevenues.length - 1] : null,
    kpi_p25: kpiP25,
    kpi_p50: kpiP50,
    kpi_p75: kpiP75,
    kpi_p90: kpiP90,
    suggested_floor: bounds.floor,
    suggested_ceiling: bounds.ceiling,
    suggested_target: bounds.target,
  };
}

export function deriveCompAwareBounds({
  sameBedCount,
  sameBedMin,
  sameBedMedian,
  sameBedP75,
  sameBedMax,
  nearbySameBedMax,
  kpiP25,
  kpiP50,
  kpiP75,
  kpiP90,
}: {
  sameBedCount: number;
  sameBedMin: number | null;
  sameBedMedian: number | null;
  sameBedP75: number | null;
  sameBedMax: number | null;
  nearbySameBedMax: number | null;
  kpiP25: number | null;
  kpiP50: number | null;
  kpiP75: number | null;
  kpiP90: number | null;
}): { floor: number | null; ceiling: number | null; target: number | null } {
  if (sameBedCount >= 3 && sameBedMax != null && sameBedMedian != null) {
    const hasNearbySameBedEvidence =
      nearbySameBedMax != null && nearbySameBedMax >= sameBedMax * 0.95;
    const premiumCap = hasNearbySameBedEvidence
      ? NEARBY_SAME_BED_PREMIUM_CAP
      : SAME_BED_PREMIUM_CAP;
    const hardCeiling = roundRevenue(sameBedMax * premiumCap);
    const softCeiling =
      sameBedP75 != null ? roundRevenue(sameBedP75 * 1.1) : hardCeiling;

    const kpiMismatch =
      kpiP50 != null && sameBedMax != null && kpiP50 > sameBedMax * 1.15;

    let ceiling = Math.min(softCeiling, hardCeiling);

    const wideSpread =
      sameBedMax != null &&
      sameBedP75 != null &&
      sameBedMax > sameBedP75 * 1.2;

    if (kpiMismatch) {
      ceiling = hardCeiling;
    } else if (wideSpread) {
      // Bimodal same-bedroom comps — allow up toward the strong tail, not just p75 of the cluster.
      ceiling = Math.min(hardCeiling, kpiP90 ?? kpiP75 ?? hardCeiling);
    } else if (kpiP75 != null) {
      ceiling = Math.min(ceiling, kpiP75);
    }

    const compFloor = roundRevenue(
      Math.max(
        sameBedMin != null ? sameBedMin * 0.95 : sameBedMedian * 0.85,
        sameBedMedian * 0.85,
      ),
    );
    const floor =
      kpiP25 != null ? Math.max(compFloor, roundRevenue(kpiP25)) : compFloor;
    const rawTarget = roundRevenue(
      sameBedMedian + (sameBedMax - sameBedMedian) * 0.55,
    );
    const target = Math.max(rawTarget, floor);

    // Ceiling must never sit below the calibrated target.
    if (target != null) {
      ceiling = Math.max(ceiling, target);
    }

    return { floor, ceiling, target };
  }

  if (kpiP50 != null) {
    const floor =
      kpiP25 ??
      kpiP50 * 0.75; /* fallback when only p50 known in sparse sets */
    return {
      floor: roundRevenue(floor),
      ceiling: kpiP90 ?? kpiP75 ?? roundRevenue(kpiP50 * 1.35),
      target: roundRevenue(kpiP50),
    };
  }

  return { floor: null, ceiling: null, target: null };
}

export function clampPositionedAnnualRevenue(
  llmAnnualRevenue: number,
  anchors: CompAnchors,
): { annualRevenue: number; wasClamped: boolean } {
  const revenue = roundRevenue(llmAnnualRevenue);
  const { suggested_floor: floor, suggested_ceiling: ceiling } = anchors;

  if (floor == null || ceiling == null) {
    return { annualRevenue: revenue, wasClamped: false };
  }

  if (revenue < floor) {
    return { annualRevenue: floor, wasClamped: true };
  }

  if (revenue > ceiling) {
    return { annualRevenue: ceiling, wasClamped: true };
  }

  return { annualRevenue: revenue, wasClamped: false };
}

/**
 * When the LLM anchors too low but nearby same-bedroom comps show a strong tail,
 * lift to the calibrated target so headline revenue aligns with page-2 evidence.
 */
export function resolvePositionedAnnualRevenue(
  llmAnnualRevenue: number,
  anchors: CompAnchors,
): { annualRevenue: number; wasAdjusted: boolean } {
  const { annualRevenue, wasClamped } = clampPositionedAnnualRevenue(
    llmAnnualRevenue,
    anchors,
  );

  const target = anchors.suggested_target;
  const nearbyMax = anchors.nearby_same_bed_max;

  if (
    target != null &&
    nearbyMax != null &&
    annualRevenue < target * 0.9 &&
    nearbyMax >= target * 0.85
  ) {
    return { annualRevenue: target, wasAdjusted: true };
  }

  return { annualRevenue, wasAdjusted: wasClamped };
}

function interpolateValue(
  points: PercentileKpiPoint[],
  percentile: number,
  pick: (point: PercentileKpiPoint) => number | null,
): number | null {
  const usable = points.filter((point) => pick(point) != null);
  if (usable.length === 0) return null;

  const first = usable[0];
  const last = usable[usable.length - 1];
  if (percentile <= first.percentile) return pick(first);
  if (percentile >= last.percentile) return pick(last);

  for (let i = 0; i < usable.length - 1; i += 1) {
    const lower = usable[i];
    const upper = usable[i + 1];
    if (percentile >= lower.percentile && percentile <= upper.percentile) {
      const span = upper.percentile - lower.percentile;
      const t = span === 0 ? 0 : (percentile - lower.percentile) / span;
      const lowerValue = pick(lower)!;
      const upperValue = pick(upper)!;
      return lowerValue + (upperValue - lowerValue) * t;
    }
  }

  return pick(last);
}

export function percentileFromRevenue(
  points: PercentileKpiPoint[],
  annualRevenue: number,
): number {
  if (points.length === 0) {
    return 50;
  }

  const sorted = [...points].sort((left, right) => left.percentile - right.percentile);
  const minPoint = sorted[0];
  const maxPoint = sorted[sorted.length - 1];

  if (annualRevenue <= minPoint.revenue) {
    return clampPercentile(minPoint.percentile);
  }

  if (annualRevenue >= maxPoint.revenue) {
    return clampPercentile(maxPoint.percentile);
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];

    if (annualRevenue >= lower.revenue && annualRevenue <= upper.revenue) {
      const span = upper.revenue - lower.revenue;
      const t = span === 0 ? 0 : (annualRevenue - lower.revenue) / span;
      return clampPercentile(
        lower.percentile + (upper.percentile - lower.percentile) * t,
      );
    }
  }

  return 50;
}

function medianSameBedOccupancy(
  comps: RawComp[],
  subjectBedrooms: number | null,
): number | null {
  const rates =
    subjectBedrooms == null
      ? []
      : comps
          .filter((comp) => compBedrooms(comp) === subjectBedrooms)
          .map(compOccupancyRate)
          .filter((value): value is number => value != null && value > 0)
          .sort((left, right) => left - right);

  if (rates.length === 0) {
    return null;
  }

  return percentileOfSorted(rates, 0.5);
}

function resolveOccupancyForRevenue(
  points: PercentileKpiPoint[],
  comps: RawComp[],
  subjectBedrooms: number | null,
  annualRevenue: number,
  fallback: number | null,
): number {
  const fromComps = medianSameBedOccupancy(comps, subjectBedrooms);
  if (fromComps != null) {
    return fromComps;
  }

  const percentile = percentileFromRevenue(points, annualRevenue);
  const fromKpi = interpolateValue(points, percentile, (p) => p.occupancyRate);
  if (fromKpi != null) {
    return fromKpi;
  }

  return fallback ?? 70;
}

/** Keep nightly rate, occupancy, and booked nights aligned with headline revenue. */
export function deriveMetricsFromRevenue(
  annualRevenue: number,
  occupancyRate: number,
): Pick<StrEstimate, "nightlyRate" | "occupancyRate" | "bookedNights"> {
  const occ = Math.min(92, Math.max(45, Math.round(occupancyRate)));
  const bookedNights = Math.max(1, Math.round((occ / 100) * 365));
  const nightlyRate = Math.round(annualRevenue / bookedNights);

  return {
    nightlyRate,
    occupancyRate: occ,
    bookedNights,
  };
}

/** Build a consistent StrEstimate at the given percentile from Airbtics' own KPI points. */
export function estimateAtPercentile(
  baseEstimate: StrEstimate,
  points: PercentileKpiPoint[],
  percentile: number,
): StrEstimate {
  const clamped = clampPercentile(percentile);
  const revenue = interpolateValue(points, clamped, (p) => p.revenue);

  if (revenue == null) {
    return baseEstimate;
  }

  return estimateAtRevenue(baseEstimate, points, Math.round(revenue));
}

export function estimateAtRevenue(
  baseEstimate: StrEstimate,
  points: PercentileKpiPoint[],
  annualRevenue: number,
  options?: {
    comps?: RawComp[];
    subjectBedrooms?: number | null;
  },
): StrEstimate {
  const roundedRevenue = roundRevenue(annualRevenue);
  const occupancyRate = resolveOccupancyForRevenue(
    points,
    options?.comps ?? [],
    options?.subjectBedrooms ?? null,
    roundedRevenue,
    baseEstimate.occupancyRate,
  );
  const metrics = deriveMetricsFromRevenue(roundedRevenue, occupancyRate);

  return {
    ...baseEstimate,
    annualRevenue: roundedRevenue,
    monthlyRevenue: roundRevenue(roundedRevenue / 12),
    weeklyRevenue: roundRevenue(roundedRevenue / 52),
    ...metrics,
  };
}

function deterministicPositionFromAnchors({
  estimate,
  points,
  comps,
  subjectBedrooms,
  anchors,
  reason,
}: {
  estimate: StrEstimate;
  points: PercentileKpiPoint[];
  comps: RawComp[];
  subjectBedrooms: number | null;
  anchors: CompAnchors;
  reason: "model_unavailable" | "insufficient_prompt_evidence" | "model_failed";
}): PositionEstimateResult {
  const medianAnnualRevenue =
    points.find((point) => point.percentile === 50)?.revenue ?? null;
  const target = anchors.suggested_target;

  if (
    points.length < 2 ||
    target == null ||
    anchors.same_bed_count < 3
  ) {
    return { estimate, positioning: null };
  }

  const { annualRevenue, wasClamped } = clampPositionedAnnualRevenue(
    target,
    anchors,
  );
  const positionedEstimate = estimateAtRevenue(
    estimate,
    points,
    annualRevenue,
    { comps, subjectBedrooms },
  );
  const percentile = percentileFromRevenue(points, annualRevenue);
  const confidence = anchors.same_bed_count >= 5 ? "medium" : "low";
  const rationale =
    reason === "insufficient_prompt_evidence"
      ? `Same-bedroom comparable listings support ${Math.round(annualRevenue).toLocaleString("en-AU")} as a measured midpoint, but the evidence set is limited.`
      : `Same-bedroom comparable listings support ${Math.round(annualRevenue).toLocaleString("en-AU")} as a measured midpoint when model review is unavailable.`;

  return {
    estimate: positionedEstimate,
    positioning: {
      percentile,
      confidence,
      rationale,
      median_annual_revenue: medianAnnualRevenue,
      llm_annual_revenue: null,
      annual_revenue: annualRevenue,
      was_clamped: wasClamped,
      comp_anchors: {
        same_bed_count: anchors.same_bed_count,
        same_bed_median: anchors.same_bed_median,
        same_bed_max: anchors.same_bed_max,
        suggested_floor: anchors.suggested_floor,
        suggested_ceiling: anchors.suggested_ceiling,
        suggested_target: anchors.suggested_target,
      },
    },
  };
}

export async function positionStrEstimate({
  subject,
  estimate,
}: {
  subject: PositionEstimateSubject;
  estimate: StrEstimate;
}): Promise<PositionEstimateResult> {
  const unpositioned: PositionEstimateResult = { estimate, positioning: null };

  const points = extractPercentileKpis(estimate.raw);
  const comps = extractComps(estimate.raw);

  if (points.length < 2 || comps.length === 0) {
    return unpositioned;
  }

  const anchors = buildCompAnchors(comps, subject.bedrooms, points);
  const medianAnnualRevenue =
    points.find((point) => point.percentile === 50)?.revenue ?? null;
  const deterministicFallback = (reason: Parameters<typeof deterministicPositionFromAnchors>[0]["reason"]) =>
    deterministicPositionFromAnchors({
      estimate,
      points,
      comps,
      subjectBedrooms: subject.bedrooms,
      anchors,
      reason,
    });

  if (!process.env.OPENAI_API_KEY) {
    return deterministicFallback("model_unavailable");
  }

  if (comps.length < MIN_COMPS_FOR_POSITIONING) {
    return deterministicFallback("insufficient_prompt_evidence");
  }

  const qualitySignals =
    subject.quality_signals?.length
      ? subject.quality_signals
      : extractStrQualitySignals({
          title: subject.listing_title,
          description: subject.listing_description,
          propertyType: subject.property_type,
        });
  const promptComps = selectPromptComps(comps, subject.bedrooms);

  const payload = {
    subject: {
      ...subject,
      quality_signals: qualitySignals,
      listing_description: subject.listing_description
        ? subject.listing_description.slice(0, MAX_DESCRIPTION_CHARS)
        : null,
    },
    revenue_distribution: points.map((point) => ({
      percentile: point.percentile,
      annual_revenue: point.revenue,
      nightly_rate: point.nightlyRate,
      occupancy_rate: point.occupancyRate,
    })),
    comp_anchors: anchors,
    comparable_listings: promptComps.map(compForPrompt),
    comparable_listing_count_sent: promptComps.length,
    comparable_listing_count_available: comps.length,
  };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: zodResponseFormat(
        positioningAiSchema,
        "str_estimate_positioning",
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
        "STR estimate positioning returned invalid JSON:",
        parsed.error.flatten(),
      );
      return deterministicFallback("model_failed");
    }

    const llmAnnualRevenue = roundRevenue(parsed.data.annual_revenue);
    const { annualRevenue, wasAdjusted } = resolvePositionedAnnualRevenue(
      llmAnnualRevenue,
      anchors,
    );
    const positionedEstimate = estimateAtRevenue(
      estimate,
      points,
      annualRevenue,
      { comps, subjectBedrooms: subject.bedrooms },
    );
    const percentile = percentileFromRevenue(points, annualRevenue);

    return {
      estimate: positionedEstimate,
      positioning: {
        percentile,
        confidence: parsed.data.confidence,
        rationale: parsed.data.rationale,
        median_annual_revenue: medianAnnualRevenue,
        llm_annual_revenue: llmAnnualRevenue,
        annual_revenue: annualRevenue,
        was_clamped: wasAdjusted,
        comp_anchors: {
          same_bed_count: anchors.same_bed_count,
          same_bed_median: anchors.same_bed_median,
          same_bed_max: anchors.same_bed_max,
          suggested_floor: anchors.suggested_floor,
          suggested_ceiling: anchors.suggested_ceiling,
          suggested_target: anchors.suggested_target,
        },
      },
    };
  } catch (error) {
    console.error(
      "STR estimate positioning failed; using median estimate:",
      error instanceof Error ? error.message : error,
    );
    return deterministicFallback("model_failed");
  }
}
