import type { FinalReportJson, StrCompCard, StrEnrichmentJson } from "@/lib/types";

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

/** Omit very weak earners when enough stronger comps exist (fraction of market median LTM). */
const MIN_COMP_ANNUAL_REVENUE_VS_MARKET_MEDIAN = 0.5;

function getCompRevenueScore(comp: Record<string, unknown>) {
  const meta = comp.similarity_score_meta;
  if (!meta || typeof meta !== "object") {
    return null;
  }

  return numberOrNull((meta as Record<string, unknown>).revenue_score);
}

function getCompAnnualRevenue(comp: Record<string, unknown>) {
  return numberOrNull(comp.annual_revenue_ltm ?? comp.annual_revenue) ?? 0;
}

function sortCompsBySimilarity(comps: Record<string, unknown>[]) {
  return [...comps].sort((left, right) => {
    const leftScore = Number(left.similarity_score ?? 0);
    const rightScore = Number(right.similarity_score ?? 0);
    return rightScore - leftScore;
  });
}

/** Sales-oriented comp cards: strongest gross revenue first, similarity as tiebreaker. */
function sortCompsByRevenueThenSimilarity(comps: Record<string, unknown>[]) {
  return [...comps].sort((left, right) => {
    const revenueDiff = getCompAnnualRevenue(right) - getCompAnnualRevenue(left);
    if (revenueDiff !== 0) {
      return revenueDiff;
    }

    const leftScore = Number(left.similarity_score ?? 0);
    const rightScore = Number(right.similarity_score ?? 0);
    return rightScore - leftScore;
  });
}

/** Max comp cards persisted on full-tier estimates (templates may show fewer). */
export const STR_ENRICHMENT_FEATURED_COMP_LIMIT = 6;

function selectFeaturedComps(
  comps: Record<string, unknown>[],
  limit = STR_ENRICHMENT_FEATURED_COMP_LIMIT,
  marketMedianAnnualRevenue?: number | null,
) {
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

  const ranked = sortCompsByRevenueThenSimilarity(pool);

  if (marketMedianAnnualRevenue && marketMedianAnnualRevenue > 0) {
    const floor =
      marketMedianAnnualRevenue * MIN_COMP_ANNUAL_REVENUE_VS_MARKET_MEDIAN;
    const aboveFloor = ranked.filter(
      (comp) => getCompAnnualRevenue(comp) >= floor,
    );

    // Prefer a smaller set of strong earners over padding with weak comps.
    if (aboveFloor.length >= 3) {
      return aboveFloor.slice(0, limit);
    }
  }

  return ranked.slice(0, limit);
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

/** Re-apply featured comp selection (e.g. after sort logic changes) using stored raw Airbtics JSON. */
export function refreshStrEnrichmentInFinalReport(
  report: FinalReportJson,
  rawAirbticsJson: unknown,
): FinalReportJson {
  if (!report.str_enrichment) {
    return report;
  }

  const refreshed = ensureStrEnrichmentFeaturedComps(
    report.str_enrichment,
    rawAirbticsJson,
  );

  if (!refreshed) {
    return report;
  }

  return { ...report, str_enrichment: refreshed };
}

/** Backfill comp cards when stored enrichment predates a higher featured limit. */
export function ensureStrEnrichmentFeaturedComps(
  enrichment: StrEnrichmentJson | null,
  rawAirbticsJson: unknown,
): StrEnrichmentJson | null {
  if (!enrichment) {
    return null;
  }

  if (!rawAirbticsJson || typeof rawAirbticsJson !== "object") {
    return enrichment;
  }

  const rebuilt = buildStrEnrichment(rawAirbticsJson as Record<string, unknown>);
  if (!rebuilt?.comps.length) {
    return enrichment;
  }

  return { ...enrichment, comps: rebuilt.comps };
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
    comps: selectFeaturedComps(
      comps,
      STR_ENRICHMENT_FEATURED_COMP_LIMIT,
      numberOrNull(p50?.ltm_revenue),
    ).map(normalizeComp),
  };
}
