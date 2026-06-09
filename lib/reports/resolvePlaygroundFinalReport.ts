import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureStrEnrichmentFeaturedComps } from "@/lib/airbtics/enrich";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { hydrateFinalReportBlurbVariants } from "@/lib/reports/hydrateFinalReportBlurbVariants";
import { normalizeReportTemplateId } from "@/lib/reports/templates/ids";
import type { Agency, AiCopyJson, FinalReportJson, Listing, Report } from "@/lib/types";

export async function resolvePlaygroundFinalReport(
  supabase: SupabaseClient,
  agency: Agency,
  listing: Listing,
  report: Report,
): Promise<FinalReportJson | null> {
  const scraped = listing.scraped_listing_json;
  const agentProfile = await loadListingAgentProfile(supabase, listing);
  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);

  if (report.final_report_json) {
    const cached = hydrateFinalReportBlurbVariants(
      report.final_report_json as FinalReportJson,
      report.ai_copy_json as AiCopyJson | null,
    );

    return enrichFinalReportMetrics(
      listing,
      mergeAgencyBrandIntoFinalReport(agency, {
        ...cached,
        template_id: normalizeReportTemplateId(cached.template_id),
        str_enrichment: ensureStrEnrichmentFeaturedComps(
          cached.str_enrichment ?? report.str_enrichment_json ?? null,
          report.raw_airbtics_json,
        ),
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
    listing,
    report,
    estimate,
    copy,
    scraped,
  });
}
