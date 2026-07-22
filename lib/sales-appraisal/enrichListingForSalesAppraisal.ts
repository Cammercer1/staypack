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

function assertScrapedListing(listing: Listing) {
  if (!listing.scraped_listing_json) {
    throw new Error(
      "Import the listing URL first so we can find sold and for-sale comparables",
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
  assertScrapedListing(listing);

  const { parsed, warnings } = await enrichParsedListingForSalesAppraisal(
    listing.scraped_listing_json!,
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

  const { data: updatedListing, error: listingError } = await supabase
    .from("listings")
    .update({ scraped_listing_json: completedParsed })
    .eq("id", listing.id)
    .select("*")
    .single();

  if (listingError || !updatedListing) {
    throw new Error(listingError?.message ?? "Failed to save sales appraisal data");
  }

  return {
    listing: updatedListing as Listing,
    parsed: completedParsed,
    warnings,
  };
}
