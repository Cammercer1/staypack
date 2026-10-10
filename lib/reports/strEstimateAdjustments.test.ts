import { describe, expect, it } from "vitest";
import { initialStrManagementScenario, resolveStrManagementPreset, applyStrEstimateAdjustments, readStrRateOverride, reconcileStrEstimate, saveStrRateOverride, strAdjustmentSchema, strManagementPresetsSchema } from "./strEstimateAdjustments";
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

describe("management assumptions", () => {
  const assumptions = { unavailableNights: 30, listingStage: "established" as const, rationale: "Professional presentation and active pricing." };
  it("constrains occupancy by availability without deducting unavailable nights twice", () => {
    const input = { mode: "management", nightlyRate: 330, occupancyRate: 68, assumptions };
    expect(strAdjustmentSchema.safeParse(input).success).toBe(true);
    expect(applyStrEstimateAdjustments(baseline, { nightlyRate: input.nightlyRate, occupancyRate: input.occupancyRate }).annualRevenue).toBe(81906);
    expect(strAdjustmentSchema.safeParse({ ...input, occupancyRate: 93 }).success).toBe(false);
    expect(strAdjustmentSchema.safeParse({ ...input, occupancyRate: 0, assumptions: { ...assumptions, unavailableNights: 365 } }).success).toBe(true);
    expect(strAdjustmentSchema.safeParse({ ...input, assumptions: { ...assumptions, unavailableNights: -1 } }).success).toBe(false);
    expect(strAdjustmentSchema.safeParse({ ...input, assumptions: { ...assumptions, rationale: " " } }).success).toBe(false);
  });
  it("preserves the report's independent assumptions on re-estimation and clears them on reset", () => {
    const rates = { nightlyRate: 330, occupancyRate: 68 };
    const saved = saveStrRateOverride(null, rates, assumptions);
    expect(saveStrRateOverride(saved, rates).strManagement).toEqual(assumptions);
    expect(saveStrRateOverride(saved, null)).not.toHaveProperty("strManagement");
    expect(saveStrRateOverride(saved, rates, null)).not.toHaveProperty("strManagement");
  });
  it("rejects duplicate presets, more than five presets and impossible availability", () => {
    const preset = { id: "ea8eedcf-4618-4be4-9d34-a8d4f0c07f17", name: "Apartments", nightlyRate: 330, occupancyRate: 68, assumptions };
    expect(strManagementPresetsSchema.safeParse([preset]).success).toBe(true);
    expect(strManagementPresetsSchema.safeParse([preset, preset]).success).toBe(false);
    expect(strManagementPresetsSchema.safeParse(Array(6).fill(preset)).success).toBe(false);
    expect(strManagementPresetsSchema.safeParse([{ ...preset, occupancyRate: 100 }]).success).toBe(false);
  });
});

describe("relative company defaults", () => {
  const assumptions = { unavailableNights: 21, listingStage: "established" as const, rationale: "Professional presentation and active pricing." };
  const preset = { id: "ea8eedcf-4618-4be4-9d34-a8d4f0c07f17", name: "Company defaults", mode: "relative" as const, isDefault: true, adrPercent: 10, occupancyPoints: 5, assumptions };
  it("adjusts the property's reconciled ADR and adds occupancy points, retaining the source assumptions", () => {
    const result = resolveStrManagementPreset(baseline, preset)!;
    expect(result.rates.nightlyRate).toBeCloseTo(reconcileStrEstimate(baseline).nightlyRate! * 1.1);
    expect(result.rates.occupancyRate).toBeCloseTo(baseline.occupancyRate! + 5);
    expect(result.assumptions).toEqual({ ...assumptions, presetName: preset.name, presetAdjustment: { adrPercent: 10, occupancyPoints: 5 } });
    expect(initialStrManagementScenario(baseline, [preset])).toEqual(result);
  });
  it("caps occupancy to available nights, supports downward adjustments and keeps zero adjustments neutral", () => {
    const capped = resolveStrManagementPreset(baseline, { ...preset, occupancyPoints: 100 })!;
    expect(capped.rates.occupancyRate / 100 * 365).toBeCloseTo(344);
    expect(strAdjustmentSchema.safeParse({ mode: "management", ...capped.rates, assumptions: capped.assumptions }).success).toBe(true);
    expect(resolveStrManagementPreset(baseline, { ...preset, occupancyPoints: -100 })!.rates.occupancyRate).toBe(0);
    const neutral = initialStrManagementScenario(baseline, [{ ...preset, adrPercent: 0, occupancyPoints: 0 }])!;
    expect(applyStrEstimateAdjustments(baseline, neutral.rates).annualRevenue).toBe(baseline.annualRevenue);
    const noAvailability = resolveStrManagementPreset(baseline, { ...preset, assumptions: { ...assumptions, unavailableNights: 365 } })!;
    expect(noAvailability.rates.occupancyRate).toBe(0);
  });
  it("does not add an invented uplift, auto-apply fixed rates, or accept multiple company defaults", () => {
    const absolute = { id: preset.id, name: "One market", nightlyRate: 900, occupancyRate: 70, assumptions };
    expect(initialStrManagementScenario(baseline, [absolute])!.rates.nightlyRate).toBe(reconcileStrEstimate(baseline).nightlyRate);
    expect(initialStrManagementScenario(baseline, [])!.assumptions).not.toHaveProperty("presetName");
    expect(strManagementPresetsSchema.safeParse([{ ...absolute, isDefault: true }]).success).toBe(false);
    expect(strManagementPresetsSchema.safeParse([preset, { ...preset, id: "da8eedcf-4618-4be4-9d34-a8d4f0c07f18" }]).success).toBe(false);
    expect(strManagementPresetsSchema.safeParse([{ ...preset, adrPercent: -100 }]).success).toBe(false);
    expect(strManagementPresetsSchema.safeParse([{ ...preset, occupancyPoints: Infinity }]).success).toBe(false);
    expect(initialStrManagementScenario({ ...baseline, occupancyRate: null }, [preset])).toBeNull();
  });
});

describe("single management uplift", () => {
  const assumptions = { unavailableNights: 0, listingStage: "established" as const, rationale: "Company operating assumption" };
  const preset = { id: "ea8eedcf-4618-4be4-9d34-a8d4f0c07f17", name: "Company uplift", mode: "uplift" as const, isDefault: true, upliftPercent: 28, assumptions };
  it("allocates 28% total revenue growth across both levers and preserves Ascot's benchmark", () => {
    const result = initialStrManagementScenario(baseline, [preset])!;
    const reference = reconcileStrEstimate(baseline);
    expect(result.rates.nightlyRate / reference.nightlyRate!).toBeCloseTo(Math.sqrt(1.28));
    expect(result.rates.occupancyRate / reference.occupancyRate!).toBeCloseTo(Math.sqrt(1.28));
    expect(applyStrEstimateAdjustments(baseline, result.rates).annualRevenue).toBe(81458);
    expect(result.assumptions.presetUpliftPercent).toBe(28);
    expect(baseline.annualRevenue).toBe(63639);
  });
  it("moves the remaining growth into ADR at the occupancy cap without losing the revenue target", () => {
    const result = resolveStrManagementPreset(baseline, { ...preset, assumptions: { ...assumptions, unavailableNights: 180 } })!;
    expect(result.rates.occupancyRate / 100 * 365).toBeCloseTo(185);
    expect(applyStrEstimateAdjustments(baseline, result.rates).annualRevenue).toBe(81458);
    expect(strAdjustmentSchema.safeParse({ mode: "management", ...result.rates, assumptions: result.assumptions }).success).toBe(true);
  });
  it("supports neutral, downward and zero-revenue scenarios and rejects impossible presets", () => {
    for (const upliftPercent of [0, -20, -100, 300]) {
      const result = resolveStrManagementPreset(baseline, { ...preset, upliftPercent })!;
      expect(applyStrEstimateAdjustments(baseline, result.rates).annualRevenue).toBe(Math.round(63639 * (1 + upliftPercent / 100)));
    }
    expect(strManagementPresetsSchema.safeParse([{ ...preset, upliftPercent: 301 }]).success).toBe(false);
    expect(strManagementPresetsSchema.safeParse([{ ...preset, assumptions: { ...assumptions, unavailableNights: 365 } }]).success).toBe(false);
    expect(strManagementPresetsSchema.safeParse([preset, { ...preset, id: "da8eedcf-4618-4be4-9d34-a8d4f0c07f18", mode: "relative", upliftPercent: undefined, adrPercent: 10, occupancyPoints: 5 }]).success).toBe(false);
    expect(initialStrManagementScenario({ ...baseline, annualRevenue: 0 }, [preset])).toBeNull();
    expect(resolveStrManagementPreset({ ...baseline, annualRevenue: 365 * .5 * 100000, occupancyRate: 50 }, { ...preset, upliftPercent: 300 })).toBeNull();
  });
});
