import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import type { Agency, Listing, Report } from "@/lib/types";

export type PlaygroundListingBundle = {
  agency: Agency;
  listing: Listing;
  report: Report;
};

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

  const candidates = (reports ?? []) as Report[];

  for (const report of candidates) {
    const finalReport = await resolvePlaygroundFinalReport(
      supabase,
      agency as Agency,
      listing as Listing,
      report,
    );
    if (finalReport) {
      return {
        agency: agency as Agency,
        listing: listing as Listing,
        report,
      };
    }
  }

  return null;
}
