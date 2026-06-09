import { requireReportWithListing } from "@/lib/auth/requireUser";
import {
  enrichPlaygroundFinalReportAgents,
  loadPlaygroundListingAgents,
  toPlaygroundListingPreview,
  type PlaygroundListingPreview,
} from "@/lib/reports/playgroundListingPreview";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import type { Agency, AgentProfile, FinalReportJson, Listing, Report } from "@/lib/types";

export type PlaygroundReportLoadResult = {
  finalReport: FinalReportJson;
  listing: Listing;
  report: Report;
  agency: Agency;
  listingPreview: PlaygroundListingPreview;
  agentProfile: AgentProfile | null;
  agencyAgents: AgentProfile[];
};

/** Loads a live report for dev template preview; returns null if missing or inaccessible. */
export async function loadPlaygroundReportOptional(
  reportId: string,
): Promise<PlaygroundReportLoadResult | null> {
  try {
    const { supabase, agency, report, listing } =
      await requireReportWithListing(reportId);
    const listingAgents = await loadPlaygroundListingAgents(supabase, agency, listing);

    let finalReport = await resolvePlaygroundFinalReport(
      supabase,
      agency,
      listing,
      report,
    );

    if (!finalReport) {
      return null;
    }

    finalReport = enrichPlaygroundFinalReportAgents(listing, finalReport, listingAgents);

    return {
      finalReport,
      listing,
      report,
      agency,
      listingPreview: toPlaygroundListingPreview(listing),
      agentProfile: listingAgents.agentProfile,
      agencyAgents: listingAgents.agencyAgents,
    };
  } catch {
    return null;
  }
}
