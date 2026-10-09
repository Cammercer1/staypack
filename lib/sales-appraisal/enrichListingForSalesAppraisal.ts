import { assertAppraisalInput, resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import { saveAppraisalResults } from "@/lib/appraisals/saveAppraisalResults";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  completedSalesAppraisalEnrichmentStatus,
  salesAppraisalEnrichmentStatus,
  withSalesAppraisalEnrichmentStatus,
} from "@/lib/sales-appraisal/enrichmentStatus";
import { enrichParsedListingForSalesAppraisal } from "@/lib/sales-appraisal/enrichParsedListingForSalesAppraisal";
import type { Listing, ParsedListing } from "@/lib/types";

function assertSaleListing(listing: Listing) {
  if (listing.listing_purpose === "lease") {
    throw new Error(
      "Property appraisals are only available for listings marked for sale",
    );
  }
}

export async function enrichListingForSalesAppraisal({
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

  const { parsed, warnings } = await enrichParsedListingForSalesAppraisal(
    resolveAppraisalInput(listing),
    { subjectListingUrl: listing.listing_url },
  );
  const previousStatus = salesAppraisalEnrichmentStatus(
    listing.scraped_listing_json,
  );
  const enrichmentRequestId = requestId ?? previousStatus?.requestId ?? randomUUID();
  const completedParsed = withSalesAppraisalEnrichmentStatus(
    parsed,
    completedSalesAppraisalEnrichmentStatus(previousStatus, enrichmentRequestId),
  );

  const updatedListing = await saveAppraisalResults({ supabase, listing, kind: "sales", parsed: completedParsed });

  return {
    listing: updatedListing as Listing,
    parsed: completedParsed,
    warnings,
  };
}
