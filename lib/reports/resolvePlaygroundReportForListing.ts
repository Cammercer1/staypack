import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import {
  isLeaseAppraisalReport,
  isLeaseAppraisalTemplateId,
} from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { Agency, Listing, Report } from "@/lib/types";

export type PlaygroundListingBundle = {
  agency: Agency;
  listing: Listing;
  report: Report;
};

async function resolveStrPlaygroundBundle(
  supabase: SupabaseClient,
  agency: Agency,
  listing: Listing,
  candidates: Report[],
): Promise<PlaygroundListingBundle | null> {
  const { data: strCollateral } = await supabase
    .from("collateral_items")
    .select("report_id")
    .eq("listing_id", listing.id)
    .eq("type", "str_report")
    .neq("status", "archived")
    .maybeSingle();

  const preferredReportId = strCollateral?.report_id ?? null;
  const orderedCandidates = preferredReportId
    ? [
        ...candidates.filter((report) => report.id === preferredReportId),
        ...candidates.filter((report) => report.id !== preferredReportId),
      ]
    : candidates;

  for (const report of orderedCandidates) {
    if (isLeaseAppraisalTemplateId(report.template_id)) {
      continue;
    }

    const finalReport = await resolvePlaygroundFinalReport(
      supabase,
      agency,
      listing,
      report,
    );

    if (finalReport && !isLeaseAppraisalReport(finalReport)) {
      return { agency, listing, report };
    }
  }

  return null;
}

/** Latest STR report for a listing that has preview data (or can be built from estimate + copy). */
export async function resolvePlaygroundReportForListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<PlaygroundListingBundle | null> {
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return null;
  }

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("*")
    .eq("id", listing.agency_id)
    .maybeSingle();

  if (agencyError || !agency) {
    return null;
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("listing_id", listingId)
    .order("updated_at", { ascending: false });

  return resolveStrPlaygroundBundle(
    supabase,
    agency as Agency,
    listing as Listing,
    (reports ?? []) as Report[],
  );
}
