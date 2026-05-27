import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadReportAgentProfile } from "@/lib/reports/loadReportAgent";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import type { Agency, FinalReportJson, Report } from "@/lib/types";

export async function resolvePlaygroundFinalReport(
  supabase: SupabaseClient,
  agency: Agency,
  report: Report,
): Promise<FinalReportJson | null> {
  const scraped = report.scraped_listing_json;
  const agentProfile = await loadReportAgentProfile(supabase, report);
  const agents = resolveReportAgents({ scraped, agentProfile });

  if (report.final_report_json) {
    const cached = report.final_report_json as FinalReportJson;

    if (agents.length > 0) {
      return {
        ...cached,
        agents,
        agent: primaryReportAgent(agents),
      };
    }

    return cached;
  }

  const estimate = resolveReportEstimate(report);
  const copy = report.ai_copy_json;

  if (!estimate || !copy) {
    return null;
  }

  return buildFinalReportJson({
    agency,
    agentProfile,
    report,
    estimate,
    copy,
    scraped,
  });
}
