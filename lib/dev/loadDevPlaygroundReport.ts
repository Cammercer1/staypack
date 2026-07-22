import { loadDevListingAccess } from "@/lib/dev/loadDevListingAccess";
import { hasServiceRoleKey } from "@/lib/env";
import type { PlaygroundReportLoadResult } from "@/lib/reports/loadPlaygroundReport";
import {
  enrichPlaygroundFinalReportAgents,
  loadPlaygroundListingAgents,
  toPlaygroundListingPreview,
} from "@/lib/reports/playgroundListingPreview";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Report } from "@/lib/types";

/** Dev-only service-role fallback so isolated preview pages do not require browser auth. */
export async function loadDevPlaygroundReportOptional(
  reportId: string,
): Promise<PlaygroundReportLoadResult | null> {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const reportAccess = await loadDevListingAccessForReport(reportId);
  if (!reportAccess) {
    return null;
  }

  const { supabase, agency, listing, report } = reportAccess;
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
}

async function loadDevListingAccessForReport(reportId: string) {
  if (process.env.NODE_ENV !== "development" || !hasServiceRoleKey()) {
    return null;
  }

  const admin = createAdminClient();
  const { data: report, error } = await admin
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !report) {
    return null;
  }

  const access = await loadDevListingAccess(report.listing_id);
  if (!access || access.agency.id !== report.agency_id) {
    return null;
  }

  return { ...access, report: report as Report };
}
