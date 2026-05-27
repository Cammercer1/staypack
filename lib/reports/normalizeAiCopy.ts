import type { Agency } from "@/lib/types";
import { DEFAULT_DISCLAIMER } from "@/lib/types";

const ARRAY_FIELDS = [
  "property_appeal_points",
  "performance_supporting_factors",
  "buyer_checks",
] as const;

const KEY_ALIASES: Record<string, string> = {
  salesPackHeading: "sales_pack_heading",
  sales_pack_heading: "sales_pack_heading",
  salesPackBlurb: "sales_pack_blurb",
  sales_pack_blurb: "sales_pack_blurb",
  keyMetricsLine: "key_metrics_line",
  key_metrics_line: "key_metrics_line",
  propertyAppealPoints: "property_appeal_points",
  property_appeal_points: "property_appeal_points",
  performanceSupportingFactors: "performance_supporting_factors",
  performance_supporting_factors: "performance_supporting_factors",
  buyerChecks: "buyer_checks",
  buyer_checks: "buyer_checks",
  methodologyNote: "methodology_note",
  methodology_note: "methodology_note",
  disclaimer: "disclaimer",
  confidenceNotes: "confidence_notes",
  confidence_notes: "confidence_notes",
};

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|•|;/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeAiCopy(raw: unknown, agency?: Agency) {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    const mappedKey = KEY_ALIASES[key] ?? key;
    normalized[mappedKey] = value;
  }

  for (const field of ARRAY_FIELDS) {
    normalized[field] = coerceStringArray(normalized[field]);
  }

  normalized.disclaimer =
    typeof normalized.disclaimer === "string" && normalized.disclaimer.trim()
      ? normalized.disclaimer
      : agency?.default_disclaimer ?? DEFAULT_DISCLAIMER;

  normalized.confidence_notes =
    typeof normalized.confidence_notes === "string"
      ? normalized.confidence_notes
      : "";

  return normalized;
}
