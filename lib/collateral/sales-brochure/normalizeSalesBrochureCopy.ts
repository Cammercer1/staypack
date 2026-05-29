import type { Agency } from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import type { SalesBrochureCopyJson } from "@/lib/collateral/templates/types";

export function normalizeSalesBrochureCopy(
  raw: unknown,
  agency: Agency,
): SalesBrochureCopyJson {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    heading: stringField(data.heading ?? data.sales_pack_heading),
    blurb: stringField(data.blurb ?? data.sales_pack_blurb),
    appeal_points: stringArray(data.appeal_points ?? data.property_appeal_points),
    feature_highlights: stringArray(
      data.feature_highlights ?? data.performance_supporting_factors,
    ),
    inspection_cta: stringField(
      data.inspection_cta ?? data.cta ?? agency.default_cta,
    ),
    disclaimer: stringField(
      data.disclaimer ?? agency.default_disclaimer ?? DEFAULT_DISCLAIMER,
    ),
    page_two_note: stringField(data.page_two_note),
  };
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}
