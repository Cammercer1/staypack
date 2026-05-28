import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  CLASSIC_LIGHT_TEMPLATE_ID,
} from "@/lib/reports/templates/ids";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import type { Agency, AirbticsTier, Report } from "@/lib/types";

/**
 * When no explicit template has been chosen yet, use the estimate tier to pick
 * the closest classic default (light vs detailed). This is a fallback only — it
 * is intentionally skipped if a report.template_id is already set.
 */
export function reportTemplateIdFromAirbticsTier(
  tier: AirbticsTier | null | undefined,
): string | null {
  if (tier === "full") {
    return CLASSIC_DETAILED_TEMPLATE_ID;
  }

  if (tier === "summary") {
    return CLASSIC_LIGHT_TEMPLATE_ID;
  }

  return null;
}

export function resolveReportTemplateIdForReport(
  agency: Agency,
  report: Report,
): string {
  // An explicit template choice always wins over the estimate-tier default.
  const explicit = resolveReportTemplateId(agency, report);
  if (explicit !== CLASSIC_LIGHT_TEMPLATE_ID && explicit !== CLASSIC_DETAILED_TEMPLATE_ID) {
    return explicit;
  }

  // If the resolved ID is still a classic default, let the tier refine light vs detailed.
  return reportTemplateIdFromAirbticsTier(report.airbtics_tier) ?? explicit;
}
