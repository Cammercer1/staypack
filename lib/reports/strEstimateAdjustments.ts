import { z } from "zod";
import type { Report, StrEnrichmentJson, StrEstimate, StrEstimateOverrides } from "@/lib/types";

export type StrRevenueBand = {
  min: number;
  max: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  source: "airbtics" | "airroi" | "fallback";
};

/** Values are validated on the server as well as in the adjustment form. */
export const strRateInputsSchema = z.object({
  nightlyRate: z.number().positive().max(100_000),
  occupancyRate: z.number().min(0).max(100),
}).strict();

export const strAdjustmentSchema = z.discriminatedUnion("mode", [
  strRateInputsSchema.extend({ mode: z.literal("rates") }),
  z.object({ mode: z.literal("baseline") }).strict(),
]);
export type StrEstimateAdjustmentInput = z.infer<typeof strRateInputsSchema>;

const MIN_FALLBACK_REVENUE_MULTIPLIER = 0.8;
const MAX_FALLBACK_REVENUE_MULTIPLIER = 1.2;
export const roundStrRevenue = Math.round;

/** Keep a saved headline intact; derive its effective gross rate per booked night.
 * Provider ADR and occupancy are independent model outputs and need not reconcile.
 * Retain full precision here; rounding controls must never silently reprice a report.
 */
export function reconcileStrEstimate(estimate: StrEstimate): StrEstimate {
  const { annualRevenue, occupancyRate } = estimate;
  if (annualRevenue == null || occupancyRate == null || occupancyRate <= 0) return estimate;
  return {
    ...estimate,
    nightlyRate: annualRevenue / (365 * occupancyRate / 100),
    bookedNights: Math.round(365 * occupancyRate / 100),
  };
}

export function applyStrEstimateAdjustments(
  estimate: StrEstimate,
  adjustments: StrEstimateAdjustmentInput,
): StrEstimate {
  const { nightlyRate, occupancyRate } = strRateInputsSchema.parse(adjustments);
  // Rounded display nights must not enter the revenue calculation.
  const expectedNights = 365 * occupancyRate / 100;
  const annualRevenue = Math.round(nightlyRate * expectedNights);
  return {
    ...estimate, nightlyRate, occupancyRate, annualRevenue,
    monthlyRevenue: Math.round(annualRevenue / 12),
    weeklyRevenue: Math.round(annualRevenue / 52),
    bookedNights: Math.round(expectedNights),
  };
}

/** Migrate only explicit agent edits; never carry an old automatic AI uplift forward. */
export function readStrRateOverride(report: Pick<Report, "user_overrides_json" | "final_estimate_json">): StrEstimateAdjustmentInput | null {
  const overrides = report.user_overrides_json;
  if (overrides?.strAdjustment) {
    const parsed = strRateInputsSchema.safeParse(overrides.strAdjustment);
    return parsed.success ? parsed.data : null;
  }
  if (overrides?.annualRevenue != null && report.final_estimate_json) {
    const reconciled = reconcileStrEstimate(report.final_estimate_json);
    const parsed = strRateInputsSchema.safeParse({ nightlyRate: reconciled.nightlyRate, occupancyRate: reconciled.occupancyRate });
    return parsed.success ? parsed.data : null;
  }
  return null;
}

/** Discard legacy revenue overrides while retaining the property inputs. */
export function saveStrRateOverride(overrides: StrEstimateOverrides | null, rates: StrEstimateAdjustmentInput | null): StrEstimateOverrides {
  return {
    ...(overrides?.estimateInputs ? { estimateInputs: overrides.estimateInputs } : {}),
    ...(rates ? { strAdjustment: rates } : {}),
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
      source: enrichment?.provider ?? "airbtics",
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
