import { assertPropertyCountry } from "@/lib/property-market/agencyCountry";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAgency, requireReportWithListing } from "@/lib/auth/requireUser";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import type { Agency, Listing, Report } from "@/lib/types";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import { appraisalStatuses, type AgencyContact, type StrAppraisal, type StrAppraisalRow } from "./types";
import { generalRecipient, recipientPayload, type AppraisalQuery, type RecipientValues } from "./validation";

/** Product entitlement seam: all existing agency members retain STR access. */
export async function requireStrWorkspaceAccess() {
  return requireAgency();
}

export async function requireStrAppraisalAccess(reportId: string) {
  const context = await requireReportWithListing(reportId);
  const { data, error } = await context.supabase.from("str_appraisals").select("*")
    .eq("report_id", reportId).eq("agency_id", context.agency.id).eq("kind", "str").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("STR appraisal not found");
  return { ...context, appraisal: data as StrAppraisal };
}

export async function loadAgencyContacts(supabase: SupabaseClient, agencyId: string, search = "") {
  let query = supabase.from("agency_contacts").select("id,name,email,phone")
    .eq("agency_id", agencyId).is("archived_at", null).order("name").limit(30);
  if (search.trim()) query = query.ilike("name", `%${search.trim().replace(/[%_\\]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AgencyContact[];
}

export async function createStrAppraisal({ supabase, agency, listing, requestId, recipient = generalRecipient, templateId, source = "manual" }: {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  requestId: string;
  recipient?: RecipientValues;
  templateId?: string;
  source?: "manual" | "managed_delivery";
}): Promise<Report> {
  if (listing.agency_id !== agency.id || listing.status === "archived") throw new Error("Choose an active property in your agency.");
  assertPropertyCountry(agency, listing);
  const photoError = collateralPhotoRequirementError(listing);
  if (photoError) throw new Error(photoError);
  const selectedTemplate = templateId ?? (await resolveAvailableTemplates(agency, "str")).defaultTemplateId;
  const { error } = await supabase.rpc("create_str_appraisal", {
    p_agency_id: agency.id, p_listing_id: listing.id, p_report_id: requestId,
    p_template_id: selectedTemplate, p_recipient: recipientPayload(recipient), p_source: source,
  });
  if (error) throw new Error(error.message);
  const { data, error: readError } = await supabase.from("reports").select("*")
    .eq("id", requestId).eq("agency_id", agency.id).single();
  if (readError) throw new Error(readError.message);
  return data as Report;
}

export const STR_PAGE_SIZE = 20;

export async function listStrAppraisals(supabase: SupabaseClient, agencyId: string, filters: AppraisalQuery) {
  // A security-invoker RPC performs cross-table search, exact pagination and
  // counts together, avoiding PostgREST OR interpolation and row-limit scans.
  const { data, error } = await supabase.rpc("list_str_appraisals", {
    p_agency_id: agencyId, p_search: filters.q, p_status: filters.status,
    p_listing_id: filters.listing_id ?? null, p_page: filters.page, p_page_size: STR_PAGE_SIZE,
  });
  if (error) throw new Error(error.message);
  return data as { rows: StrAppraisalRow[]; total: number; counts: Record<keyof typeof appraisalStatuses, number> };
}
