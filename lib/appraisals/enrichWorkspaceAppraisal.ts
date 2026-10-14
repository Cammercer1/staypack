import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichParsedListingForLeaseAppraisal } from "@/lib/lease-appraisal/enrichParsedListingForLeaseAppraisal";
import { enrichParsedListingForSalesAppraisal } from "@/lib/sales-appraisal/enrichParsedListingForSalesAppraisal";
import { resolveAppraisalInput, assertAppraisalInput, mergeAppraisalResults } from "./resolveAppraisalInput";
import { appraisalListing } from "./workspaceInputs";
import { saveWorkspaceInputs, checkAppraisalError } from "./workspacePersistence";
import type { WorkspaceAppraisal } from "./workspaceTypes";
import type { Listing } from "@/lib/types";

/** Called by the existing background workers. Never writes to the shared property. */
export async function enrichWorkspaceAppraisal({ supabase, reportId, agencyId, kind, expected }: {
  supabase: SupabaseClient; reportId: string; agencyId: string; kind: "lease" | "sales"; expected: string;
}) {
  const row = await supabase.from("appraisals").select("*").eq("report_id", reportId).eq("agency_id", agencyId).eq("kind", kind).single();
  checkAppraisalError(row.error);
  const appraisal = row.data as WorkspaceAppraisal;
  if (appraisal.updated_at !== expected) throw new Error("This appraisal changed while the search was queued. Refresh comparables again.");
  const report = await supabase.from("reports").select("listing_id").eq("id", reportId).eq("agency_id", agencyId).neq("status", "archived").single();
  checkAppraisalError(report.error);
  const property = await supabase.from("listings").select("*").eq("id", report.data!.listing_id).eq("agency_id", agencyId).neq("status", "archived").single();
  checkAppraisalError(property.error);
  const listing = appraisalListing(property.data as Listing, appraisal);
  assertAppraisalInput(listing);
  const input = resolveAppraisalInput(listing, { applyOverrides: false });
  const result = await (kind === "lease" ? enrichParsedListingForLeaseAppraisal : enrichParsedListingForSalesAppraisal)(input, { subjectListingUrl: listing.listing_url });
  const saved = await saveWorkspaceInputs(supabase, appraisal, { ...listing, scraped_listing_json: mergeAppraisalResults(listing, kind, result.parsed) }, expected);
  return { ...result, listing: appraisalListing(property.data as Listing, saved) };
}
