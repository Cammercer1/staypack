import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeAppraisalResults, type AppraisalKind } from "./resolveAppraisalInput";
import type { Listing, ParsedListing } from "@/lib/types";

export async function saveAppraisalResults({ supabase, listing, kind, parsed }: {
  supabase: SupabaseClient;
  listing: Listing;
  kind: AppraisalKind;
  parsed: ParsedListing;
}): Promise<Listing> {
  const { data, error } = await supabase.from("listings")
    .update({ scraped_listing_json: mergeAppraisalResults(listing, kind, parsed) })
    .eq("id", listing.id)
    .eq("agency_id", listing.agency_id)
    .eq("updated_at", listing.updated_at)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Property details changed while the appraisal was running. Reload and fetch comparables again.");
  return data as Listing;
}
