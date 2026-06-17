import type { StrEnrichmentJson, StrEstimate } from "@/lib/types";

export type StrRevenueBand = {
  min: number;
  max: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  source: "airbtics" | "fallback";
};

export type StrEstimateAdjustmentInput = {
  annualRevenue?: number | null;
  occupancyRate?: number | null;
};

const MIN_FALLBACK_REVENUE_MULTIPLIER = 0.8;
const MAX_FALLBACK_REVENUE_MULTIPLIER = 1.2;

export function roundStrRevenue(value: number) {
  return Math.round(value);
}

export function normalizeStrOccupancyRate(value: number) {
  if (!Number.isFinite(value)) {
    return 70;
  }

  return Math.min(100, Math.max(1, Math.round(value)));
}

export function deriveStrMetricsFromRevenueAndOccupancy(
  annualRevenue: number,
  occupancyRate: number,
): Pick<StrEstimate, "nightlyRate" | "occupancyRate" | "bookedNights"> {
  const occupancy = normalizeStrOccupancyRate(occupancyRate);
  const bookedNights = Math.max(1, Math.round((occupancy / 100) * 365));

  return {
    nightlyRate: Math.round(annualRevenue / bookedNights),
    occupancyRate: occupancy,
    bookedNights,
  };
}

export function applyStrEstimateAdjustments(
  estimate: StrEstimate,
  adjustments: StrEstimateAdjustmentInput,
): StrEstimate {
  const annualRevenue =
    adjustments.annualRevenue != null && Number.isFinite(adjustments.annualRevenue)
      ? roundStrRevenue(adjustments.annualRevenue)
      : estimate.annualRevenue;
  const occupancyRate =
    adjustments.occupancyRate != null && Number.isFinite(adjustments.occupancyRate)
      ? normalizeStrOccupancyRate(adjustments.occupancyRate)
      : estimate.occupancyRate;

  if (annualRevenue == null) {
    return {
      ...estimate,
      occupancyRate,
      bookedNights:
        occupancyRate != null ? Math.round((occupancyRate / 100) * 365) : estimate.bookedNights,
    };
  }

  const metrics = deriveStrMetricsFromRevenueAndOccupancy(
    annualRevenue,
    occupancyRate ?? 70,
  );

  return {
    ...estimate,
    annualRevenue,
    monthlyRevenue: roundStrRevenue(annualRevenue / 12),
    weeklyRevenue: roundStrRevenue(annualRevenue / 52),
    ...metrics,
  };
}

export function resolveStrRevenueBand(
  enrichment: StrEnrichmentJson | null | undefined,
  estimate: StrEstimate | null | undefined,
): StrRevenueBand | null {
  const range = enrichment?.revenue_range;
  const p25 = positiveNumberOrNull(range?.p25);
  const p50 = positiveNumberOrNull(range?.p50);
  const p75 = positiveNumberOrNull(range?.p75);
  const p90 = positiveNumberOrNull(range?.p90);

  if (p25 != null && p90 != null && p90 > p25) {
    return {
      min: p25,
      max: p90,
      p25,
      p50,
      p75,
      p90,
      source: "airbtics",
    };
  }

  const annualRevenue = positiveNumberOrNull(estimate?.annualRevenue);
  if (annualRevenue == null) {
    return null;
  }

  const min = Math.max(1, roundStrRevenue(annualRevenue * MIN_FALLBACK_REVENUE_MULTIPLIER));
  const max = roundStrRevenue(annualRevenue * MAX_FALLBACK_REVENUE_MULTIPLIER);

  return {
    min,
    max,
    p25: min,
    p50: annualRevenue,
    p75: null,
    p90: max,
    source: "fallback",
  };
}

function positiveNumberOrNull(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
