import type { StrCompCard, StrEnrichmentJson } from "@/lib/types";

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unwrapMessage(raw: Record<string, unknown>) {
  if (raw.message && typeof raw.message === "object") {
    return raw.message as Record<string, unknown>;
  }

  return raw;
}

function buildSeasonality(
  lowRevenue: Record<string, unknown> | undefined,
  midRevenue: Record<string, unknown> | undefined,
  highRevenue: Record<string, unknown> | undefined,
  monthlyOccupancy: Record<string, unknown> | undefined,
  monthlyAdr: Record<string, unknown> | undefined,
) {
  const monthKeys = new Set([
    ...Object.keys(lowRevenue ?? {}),
    ...Object.keys(midRevenue ?? {}),
    ...Object.keys(highRevenue ?? {}),
  ]);

  if (monthKeys.size === 0) {
    return [];
  }

  return [...monthKeys]
    .sort()
    .slice(-12)
    .map((month) => ({
      month,
      revenue_low: numberOrNull(lowRevenue?.[month]),
      revenue: numberOrNull(midRevenue?.[month]),
      revenue_high: numberOrNull(highRevenue?.[month]),
      occupancy: numberOrNull(monthlyOccupancy?.[month]),
      adr: numberOrNull(monthlyAdr?.[month]),
    }));
}

/** Drop comps Airbtics scored as weak revenue performers before picking featured cards. */
const MIN_COMP_REVENUE_SCORE = 0.07;

function getCompRevenueScore(comp: Record<string, unknown>) {
  const meta = comp.similarity_score_meta;
  if (!meta || typeof meta !== "object") {
    return null;
  }

  return numberOrNull((meta as Record<string, unknown>).revenue_score);
}

function sortCompsBySimilarity(comps: Record<string, unknown>[]) {
  return [...comps].sort((left, right) => {
    const leftScore = Number(left.similarity_score ?? 0);
    const rightScore = Number(right.similarity_score ?? 0);
    return rightScore - leftScore;
  });
}

function selectFeaturedComps(comps: Record<string, unknown>[], limit = 3) {
  const bySimilarity = sortCompsBySimilarity(comps);
  const revenueQualified = bySimilarity.filter((comp) => {
    const revenueScore = getCompRevenueScore(comp);
    if (revenueScore == null) {
      return true;
    }

    return revenueScore >= MIN_COMP_REVENUE_SCORE;
  });

  const pool =
    revenueQualified.length >= limit ? revenueQualified : bySimilarity;

  return pool.slice(0, limit);
}

function normalizeComp(raw: Record<string, unknown>): StrCompCard {
  return {
    listing_id: String(raw.listingID ?? raw.listing_id ?? ""),
    name: String(raw.name ?? "Comparable listing"),
    thumbnail_url: String(raw.thumbnail_url ?? ""),
    listing_url: String(raw.listing_url ?? ""),
    bedrooms: numberOrNull(raw.bedrooms),
    bathrooms: numberOrNull(raw.bathrooms),
    accommodates: numberOrNull(raw.accommodates),
    distance_m: numberOrNull(raw.distance),
    annual_revenue: numberOrNull(raw.annual_revenue_ltm ?? raw.annual_revenue),
    occupancy_rate: numberOrNull(
      raw.avg_occupancy_rate_ltm ?? raw.occupancy_rate,
    ),
    nightly_rate: numberOrNull(
      raw.avg_booked_daily_rate_ltm ?? raw.nightly_rate,
    ),
  };
}

export function buildStrEnrichment(
  raw: Record<string, unknown>,
): StrEnrichmentJson | null {
  const message = unwrapMessage(raw);
  const reportType = String(message.report_type ?? "");

  if (reportType !== "all" && !Array.isArray(message.comps)) {
    return null;
  }

  const comps = Array.isArray(message.comps)
    ? (message.comps as Record<string, unknown>[])
    : [];
  const kpis = message.kpis as
    | Record<string, Record<string, unknown>>
    | undefined;
  const p25 = kpis?.["25"];
  const p50 = kpis?.["50"];
  const p75 = kpis?.["75"];
  const revenueRange = kpis
    ? {
        p25: numberOrNull(kpis["25"]?.ltm_revenue),
        p50: numberOrNull(kpis["50"]?.ltm_revenue),
        p75: numberOrNull(kpis["75"]?.ltm_revenue),
        p90: numberOrNull(kpis["90"]?.ltm_revenue),
      }
    : null;

  return {
    tier: "full",
    comp_count: comps.length,
    radius_m: numberOrNull(message.radius),
    revenue_range: revenueRange,
    seasonality: buildSeasonality(
      p25?.monthly_revenue as Record<string, unknown> | undefined,
      p50?.monthly_revenue as Record<string, unknown> | undefined,
      p75?.monthly_revenue as Record<string, unknown> | undefined,
      p50?.monthly_occupancy_rate as Record<string, unknown> | undefined,
      p50?.monthly_adr as Record<string, unknown> | undefined,
    ),
    comps: selectFeaturedComps(comps).map(normalizeComp),
  };
}
