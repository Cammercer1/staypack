import { describe, expect, it } from "vitest";
import { applyStrEstimateAdjustments, readStrRateOverride, reconcileStrEstimate, saveStrRateOverride, strAdjustmentSchema } from "./strEstimateAdjustments";
import type { StrEstimate } from "@/lib/types";

const baseline: StrEstimate = { annualRevenue: 63639, monthlyRevenue: 5303, weeklyRevenue: 1224, nightlyRate: 318.6921, occupancyRate: 56.45543, bookedNights: 206, radiusM: 2000, raw: { provider: "airroi" } };

describe("ADR and occupancy adjustments", () => {
  it("reconciles independent provider metrics without changing the headline or source", () => {
    const result = reconcileStrEstimate(baseline);
    expect(result.annualRevenue).toBe(63639);
    expect(result.nightlyRate! * result.occupancyRate! / 100 * 365).toBeCloseTo(63639);
    expect(result.raw).toBe(baseline.raw);
    expect(baseline.nightlyRate).toBe(318.6921);
  });
  it("uses fractional occupied nights and changes revenue with either lever", () => {
    const first = applyStrEstimateAdjustments(baseline, { nightlyRate: 400, occupancyRate: 75 });
    expect(first).toMatchObject({ annualRevenue: 109500, monthlyRevenue: 9125, weeklyRevenue: 2106, bookedNights: 274, nightlyRate: 400, occupancyRate: 75 });
    expect(applyStrEstimateAdjustments(first, { nightlyRate: 400, occupancyRate: 50 }).annualRevenue).toBe(73000);
    expect(applyStrEstimateAdjustments(first, { nightlyRate: 300, occupancyRate: 75 }).annualRevenue).toBe(82125);
    expect(applyStrEstimateAdjustments(baseline, { nightlyRate: 308.81, occupancyRate: 56.46 }).annualRevenue).toBe(63639);
  });
  it("handles zero and full occupancy without inventing nights or dividing by zero", () => {
    expect(applyStrEstimateAdjustments(baseline, { nightlyRate: 320, occupancyRate: 0 })).toMatchObject({ annualRevenue: 0, monthlyRevenue: 0, weeklyRevenue: 0, nightlyRate: 320, bookedNights: 0 });
    expect(applyStrEstimateAdjustments(baseline, { nightlyRate: 320, occupancyRate: 100 })).toMatchObject({ annualRevenue: 116800, bookedNights: 365 });
  });
  it.each([{ nightlyRate: 0, occupancyRate: 60 }, { nightlyRate: 320, occupancyRate: -1 }, { nightlyRate: 320, occupancyRate: 101 }, { nightlyRate: Infinity, occupancyRate: 60 }, { nightlyRate: 320, occupancyRate: NaN }, { nightlyRate: 320, occupancyRate: 60, annualRevenue: 1 }])("rejects invalid or forged inputs %j", (rates) => {
    expect(strAdjustmentSchema.safeParse({ mode: "rates", ...rates }).success).toBe(false);
  });
  it("preserves explicit edits on refresh, migrates legacy edits and ignores automatic positioning", () => {
    const rates = { nightlyRate: 320, occupancyRate: 0 };
    expect(readStrRateOverride({ user_overrides_json: { strAdjustment: rates }, final_estimate_json: baseline })).toEqual(rates);
    expect(readStrRateOverride({ user_overrides_json: null, final_estimate_json: baseline })).toBeNull();
    const legacy = readStrRateOverride({ user_overrides_json: { annualRevenue: 63639 }, final_estimate_json: baseline });
    expect(applyStrEstimateAdjustments(baseline, legacy!).annualRevenue).toBe(63639);
    expect(saveStrRateOverride({ annualRevenue: 99999, estimateInputs: { bedrooms: 3, bathrooms: 2, accommodates: 6 } }, null)).toEqual({ estimateInputs: { bedrooms: 3, bathrooms: 2, accommodates: 6 } });
  });
});
