import { normaliseAirbticsResponse } from "@/lib/airbtics/client";
import type { Report, StrEstimate } from "@/lib/types";

export function resolveReportEstimate(report: Report): StrEstimate | null {
  const raw =
    report.final_estimate_json ?? report.original_estimate_json ?? null;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const hasCamelCase =
    "annualRevenue" in source ||
    "monthlyRevenue" in source ||
    "occupancyRate" in source;
  const hasSnakeCase =
    "annual_revenue" in source ||
    "monthly_revenue" in source ||
    "occupancy_rate" in source;

  if (hasCamelCase && !hasSnakeCase) {
    return {
      annualRevenue: numberOrNull(source.annualRevenue),
      monthlyRevenue: numberOrNull(source.monthlyRevenue),
      weeklyRevenue: numberOrNull(source.weeklyRevenue),
      nightlyRate: numberOrNull(source.nightlyRate),
      occupancyRate: numberOrNull(source.occupancyRate),
      bookedNights: numberOrNull(source.bookedNights),
      radiusM: numberOrNull(source.radiusM),
      raw: source.raw ?? source,
    };
  }

  return normaliseAirbticsResponse(source);
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
