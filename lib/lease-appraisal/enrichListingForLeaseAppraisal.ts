import { assertAppraisalInput, resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import { saveAppraisalResults } from "@/lib/appraisals/saveAppraisalResults";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  completedLeaseAppraisalEnrichmentStatus,
  leaseAppraisalEnrichmentStatus,
  withLeaseAppraisalEnrichmentStatus,
} from "@/lib/lease-appraisal/enrichmentStatus";
import { enrichParsedListingForLeaseAppraisal } from "@/lib/lease-appraisal/enrichParsedListingForLeaseAppraisal";
import type { Listing, ParsedListing } from "@/lib/types";

function assertSaleListing(listing: Listing) {
  if (listing.listing_purpose === "lease") {
    throw new Error(
      "Rental appraisals are only available for listings marked for sale",
    );
  }
}

export async function enrichListingForLeaseAppraisal({
  supabase,
  listing,
  requestId,
}: {
  supabase: SupabaseClient;
  listing: Listing;
  requestId?: string;
}): Promise<{ listing: Listing; parsed: ParsedListing; warnings: string[] }> {
  assertSaleListing(listing);
  assertAppraisalInput(listing);

  const { parsed, warnings } = await enrichParsedListingForLeaseAppraisal(
    resolveAppraisalInput(listing),
    { subjectListingUrl: listing.listing_url },
  );
  const previousStatus = leaseAppraisalEnrichmentStatus(
    listing.scraped_listing_json,
  );
  const enrichmentRequestId = requestId ?? previousStatus?.requestId ?? randomUUID();
  const completedParsed = withLeaseAppraisalEnrichmentStatus(
    parsed,
    completedLeaseAppraisalEnrichmentStatus(previousStatus, enrichmentRequestId),
  );

  const updatedListing = await saveAppraisalResults({ supabase, listing, kind: "lease", parsed: completedParsed });

  return {
    listing: updatedListing as Listing,
    parsed: completedParsed,
    warnings,
  };
}
