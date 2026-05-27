import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadAgencyAgentProfiles, loadReportAgentProfile } from "@/lib/reports/loadReportAgent";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { normalizeReportTemplateId } from "@/lib/reports/templates/ids";
import type { Agency, FinalReportJson, Report } from "@/lib/types";

export async function resolvePlaygroundFinalReport(
  supabase: SupabaseClient,
  agency: Agency,
  report: Report,
): Promise<FinalReportJson | null> {
  const scraped = report.scraped_listing_json;
  const agentProfile = await loadReportAgentProfile(supabase, report);
  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);

  if (report.final_report_json) {
    const cached = report.final_report_json as FinalReportJson;

    return enrichFinalReportMetrics(
      report,
      mergeAgencyBrandIntoFinalReport(agency, {
        ...cached,
        template_id: normalizeReportTemplateId(cached.template_id),
        str_enrichment: cached.str_enrichment ?? report.str_enrichment_json ?? null,
      }),
      { agentProfile, agencyAgents },
    );
  }

  const estimate = resolveReportEstimate(report);
  const copy = report.ai_copy_json;

  if (!estimate || !copy) {
    return null;
  }

  return buildFinalReportJson({
    agency,
    agentProfile,
    agencyAgents,
    report,
    estimate,
    copy,
    scraped,
  });
}
