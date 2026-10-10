import { z } from "zod";
import type { Report, StrEnrichmentJson, StrEstimate, StrEstimateOverrides, StrManagementAssumptions, StrManagementPreset } from "@/lib/types";

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

const relativeAdjustmentSchema = z.object({
  adrPercent: z.number().min(-99).max(300),
  occupancyPoints: z.number().min(-100).max(100),
}).strict();

export const strUpliftPercentSchema = z.number().min(-100).max(300);

export const strManagementAssumptionsSchema = z.object({
  unavailableNights: z.number().int().min(0).max(365),
  listingStage: z.enum(["established", "launch_year"]),
  rationale: z.string().trim().min(1, "Explain the operating assumptions").max(300),
  presetName: z.string().trim().min(1).max(80).optional(),
  presetAdjustment: relativeAdjustmentSchema.optional(),
  presetUpliftPercent: strUpliftPercentSchema.optional(),
}).strict();

const managementRatesSchema = strRateInputsSchema.extend({
  assumptions: strManagementAssumptionsSchema,
});

function fitsAvailability(value: { occupancyRate: number; assumptions: StrManagementAssumptions }) {
  return value.occupancyRate / 100 * 365 <= 365 - value.assumptions.unavailableNights + 0.000001;
}
const availabilityMessage = "Booked nights exceed the nights available. Reduce occupancy or unavailable nights.";

const presetFields = {
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
};
export const strManagementPresetSchema = z.union([
  managementRatesSchema.extend({ ...presetFields, mode: z.literal("absolute").optional(), isDefault: z.literal(false).optional() })
    .strict().refine(fitsAvailability, { message: availabilityMessage, path: ["occupancyRate"] }),
  relativeAdjustmentSchema.extend({ ...presetFields, mode: z.literal("relative"), isDefault: z.boolean().optional(), assumptions: strManagementAssumptionsSchema }).strict(),
  z.object({ ...presetFields, mode: z.literal("uplift"), isDefault: z.boolean().optional(), upliftPercent: strUpliftPercentSchema, assumptions: strManagementAssumptionsSchema }).strict()
    .refine((preset) => preset.assumptions.unavailableNights < 365 || preset.upliftPercent === -100, "A positive revenue estimate requires at least one available night"),
]);
export const strManagementPresetsSchema = z.array(strManagementPresetSchema).max(5)
  .refine((presets) => new Set(presets.map((preset) => preset.id)).size === presets.length, "Preset IDs must be unique")
  .refine((presets) => presets.filter((preset) => preset.isDefault).length <= 1, "Choose one company default");

export const strAdjustmentSchema = z.discriminatedUnion("mode", [
  strRateInputsSchema.extend({ mode: z.literal("rates") }),
  managementRatesSchema.extend({ mode: z.literal("management") }),
  z.object({ mode: z.literal("baseline") }).strict(),
]).refine((value) => value.mode !== "management" || fitsAvailability(value), { message: availabilityMessage, path: ["occupancyRate"] });
export type StrEstimateAdjustmentInput = z.infer<typeof strRateInputsSchema>;

export const DEFAULT_STR_MANAGEMENT_ASSUMPTIONS: StrManagementAssumptions = {
  unavailableNights: 0,
  listingStage: "established",
  rationale: "Assumes professional presentation and active pricing, with availability as stated.",
};

/** A transparent allocation rule, not a prediction of the effect of management.
 * Split the revenue factor equally across ADR and relative occupancy. Once
 * occupancy reaches available nights, ADR supplies the remaining increase.
 */
export function resolveStrUplift(baseline: StrEstimate, upliftPercent: number, unavailableNights = 0): StrEstimateAdjustmentInput | null {
  if (!strUpliftPercentSchema.safeParse(upliftPercent).success || !Number.isInteger(unavailableNights) || unavailableNights < 0 || unavailableNights > 365) return null;
  const reference = reconcileStrEstimate(baseline);
  if (reference.annualRevenue == null || reference.annualRevenue <= 0 || reference.nightlyRate == null || reference.nightlyRate <= 0 || reference.occupancyRate == null || reference.occupancyRate <= 0) return null;
  const factor = 1 + upliftPercent / 100;
  const occupancyRate = Math.min((365 - unavailableNights) / 365 * 100, reference.occupancyRate * Math.sqrt(factor));
  if (factor > 0 && occupancyRate <= 0) return null;
  const nightlyRate = factor === 0 ? reference.nightlyRate : reference.annualRevenue * factor / (365 * occupancyRate / 100);
  const rates = strRateInputsSchema.safeParse({ nightlyRate, occupancyRate });
  return rates.success ? rates.data : null;
}

/** Resolve from the original property benchmark, never from an already adjusted estimate. */
export function resolveStrManagementPreset(baseline: StrEstimate, preset: StrManagementPreset) {
  const checked = strManagementPresetSchema.parse(preset);
  const reference = reconcileStrEstimate(baseline);
  let rates: StrEstimateAdjustmentInput;
  if (checked.mode === "uplift") {
    const resolved = resolveStrUplift(baseline, checked.upliftPercent, checked.assumptions.unavailableNights);
    if (!resolved) return null;
    rates = resolved;
  } else if (checked.mode === "relative") {
    const startingRates = strRateInputsSchema.safeParse({ nightlyRate: reference.nightlyRate, occupancyRate: reference.occupancyRate });
    if (!startingRates.success) return null;
    const maxOccupancy = (365 - checked.assumptions.unavailableNights) / 365 * 100;
    rates = {
      nightlyRate: Math.min(100_000, startingRates.data.nightlyRate * (1 + checked.adrPercent / 100)),
      occupancyRate: Math.min(maxOccupancy, Math.max(0, startingRates.data.occupancyRate + checked.occupancyPoints)),
    };
  } else {
    rates = { nightlyRate: checked.nightlyRate, occupancyRate: checked.occupancyRate };
  }
  return {
    rates,
    assumptions: {
      ...checked.assumptions,
      presetName: checked.name,
      ...(checked.mode === "relative" ? { presetAdjustment: { adrPercent: checked.adrPercent, occupancyPoints: checked.occupancyPoints } } : {}),
      ...(checked.mode === "uplift" ? { presetUpliftPercent: checked.upliftPercent } : {}),
    },
  };
}

/** Called only on the first estimate; reviewed reports never follow live company settings. */
export function initialStrManagementScenario(baseline: StrEstimate, presets?: StrManagementPreset[] | null) {
  const parsed = strManagementPresetsSchema.safeParse(presets ?? []);
  const preset = parsed.success ? parsed.data.find((item) => item.isDefault) : undefined;
  if (preset) return resolveStrManagementPreset(baseline, preset);
  const reference = reconcileStrEstimate(baseline);
  const rates = strRateInputsSchema.safeParse({ nightlyRate: reference.nightlyRate, occupancyRate: reference.occupancyRate });
  return rates.success ? { rates: rates.data, assumptions: { ...DEFAULT_STR_MANAGEMENT_ASSUMPTIONS } } : null;
}

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
export function saveStrRateOverride(
  overrides: StrEstimateOverrides | null,
  rates: StrEstimateAdjustmentInput | null,
  management: StrManagementAssumptions | null | undefined = overrides?.strManagement,
): StrEstimateOverrides {
  return {
    ...(overrides?.estimateInputs ? { estimateInputs: overrides.estimateInputs } : {}),
    ...(rates ? { strAdjustment: rates } : {}),
    ...(rates && management ? { strManagement: strManagementAssumptionsSchema.parse(management) } : {}),
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
