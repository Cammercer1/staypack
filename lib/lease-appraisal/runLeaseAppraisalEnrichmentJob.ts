import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichParsedListingForLeaseAppraisal } from "@/lib/lease-appraisal/enrichParsedListingForLeaseAppraisal";
import {
  completedLeaseAppraisalEnrichmentStatus,
  failedLeaseAppraisalEnrichmentStatus,
  leaseAppraisalEnrichmentStatus,
  withLeaseAppraisalEnrichmentStatus,
} from "@/lib/lease-appraisal/enrichmentStatus";
import type { Listing, ParsedListing } from "@/lib/types";

type RunLeaseAppraisalEnrichmentJobInput = {
  supabase: SupabaseClient;
  listingId: string;
  agencyId: string;
  requestId: string;
};

async function loadListing({
  supabase,
  listingId,
  agencyId,
}: Pick<RunLeaseAppraisalEnrichmentJobInput, "supabase" | "listingId" | "agencyId">) {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Listing not found");
  }

  return data as Listing;
}

async function saveParsedListing({
  supabase,
  listingId,
  agencyId,
  parsed,
}: Pick<RunLeaseAppraisalEnrichmentJobInput, "supabase" | "listingId" | "agencyId"> & {
  parsed: ParsedListing;
}) {
  const { data, error } = await supabase
    .from("listings")
    .update({ scraped_listing_json: parsed })
    .eq("id", listingId)
    .eq("agency_id", agencyId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save rental appraisal data");
  }

  return data as Listing;
}

function shouldWriteForRequest(parsed: ParsedListing, requestId: string) {
  const status = leaseAppraisalEnrichmentStatus(parsed);
  return !status?.requestId || status.requestId === requestId;
}

export async function runLeaseAppraisalEnrichmentJob({
  supabase,
  listingId,
  agencyId,
  requestId,
}: RunLeaseAppraisalEnrichmentJobInput) {
  try {
    const listing = await loadListing({ supabase, listingId, agencyId });
    const parsed = listing.scraped_listing_json;

    if (!parsed) {
      throw new Error("Import the listing URL first");
    }

    if (!shouldWriteForRequest(parsed, requestId)) {
      return null;
    }

    const { parsed: enriched } = await enrichParsedListingForLeaseAppraisal(parsed);
    const latest = await loadListing({ supabase, listingId, agencyId });
    const latestParsed = latest.scraped_listing_json;

    if (!latestParsed || !shouldWriteForRequest(latestParsed, requestId)) {
      return null;
    }

    const completed = withLeaseAppraisalEnrichmentStatus(
      enriched,
      completedLeaseAppraisalEnrichmentStatus(
        leaseAppraisalEnrichmentStatus(latestParsed),
        requestId,
      ),
    );

    return saveParsedListing({
      supabase,
      listingId,
      agencyId,
      parsed: completed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch rental comps";

    try {
      const listing = await loadListing({ supabase, listingId, agencyId });
      const parsed = listing.scraped_listing_json;

      if (parsed && shouldWriteForRequest(parsed, requestId)) {
        await saveParsedListing({
          supabase,
          listingId,
          agencyId,
          parsed: withLeaseAppraisalEnrichmentStatus(
            parsed,
            failedLeaseAppraisalEnrichmentStatus(
              leaseAppraisalEnrichmentStatus(parsed),
              requestId,
              message,
            ),
          ),
        });
      }
    } catch (saveError) {
      console.error(
        "Failed to save lease appraisal enrichment failure status:",
        saveError,
      );
    }

    throw error;
  }
}
