import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  CLASSIC_LIGHT_TEMPLATE_ID,
} from "@/lib/reports/templates/ids";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import type { Agency, AirbticsTier, Report } from "@/lib/types";

/** Report layout variant implied by the STR estimate tier last run on this report. */
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
  return (
    reportTemplateIdFromAirbticsTier(report.airbtics_tier) ??
    resolveReportTemplateId(agency, report)
  );
}
