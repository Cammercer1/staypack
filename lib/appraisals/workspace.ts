import { checkAppraisalError } from "./workspacePersistence";
export { checkAppraisalError, saveWorkspaceInputs } from "./workspacePersistence";
import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { ProposalError } from "@/lib/digital-proposals/errors";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { createStrAppraisal } from "@/lib/str-appraisals/service";
import { recipientPayload, type RecipientValues } from "@/lib/str-appraisals/validation";
import { appraisalListing, captureAppraisalInputs } from "./workspaceInputs";
import type { Agency, Listing } from "@/lib/types";
import type { WorkspaceAppraisal, WorkspaceAppraisalKind, WorkspaceAppraisalRow } from "./workspaceTypes";

export async function requireAppraisalAccess(reportId: string) {
  if (!z.uuid().safeParse(reportId).success) throw new ProposalError("Appraisal not found.", 404);
  const context = await requireReportWithListing(reportId).catch(error => {
    if (error instanceof Error && /^(Report|Listing) not found$/.test(error.message)) throw new ProposalError("Appraisal not found.", 404);
    throw error;
  });
  const result = await context.supabase.from("appraisals").select("*").eq("report_id", reportId).eq("agency_id", context.agency.id).maybeSingle();
  checkAppraisalError(result.error);
  if (!result.data) throw new ProposalError("Appraisal not found.", 404);
  const appraisal = result.data as WorkspaceAppraisal;
  return { ...context, appraisal, workingListing: appraisalListing(context.listing, appraisal) };
}
export function requireEditableAppraisal(context: Awaited<ReturnType<typeof requireAppraisalAccess>>) {
  if (context.appraisal.kind === "str") throw new ProposalError("Use the short-term rental editor for this appraisal.");
  if (context.report.status === "archived" || context.listing.status === "archived") throw new ProposalError("Restore this appraisal and its property before editing.", 409);
  return context.appraisal.kind;
}
export async function createWorkspaceAppraisal({ supabase, agency, listing, requestId, recipient, kind }: {
  supabase: SupabaseClient; agency: Agency; listing: Listing; requestId: string; recipient: RecipientValues; kind: WorkspaceAppraisalKind;
}) {
  if (kind === "str") return createStrAppraisal({ supabase, agency, listing, requestId, recipient });
  if (listing.status === "archived" || listing.agency_id !== agency.id) throw new ProposalError("Choose an active property in your agency.");
  const photoError = collateralPhotoRequirementError(listing);
  if (photoError) throw new ProposalError(photoError);
  const templates = await resolveAvailableTemplates(agency, kind === "lease" ? "lease" : "sales_appraisal");
  const result = await supabase.rpc("create_appraisal", { p_agency_id: agency.id, p_listing_id: listing.id, p_report_id: requestId, p_kind: kind,
    p_template_id: templates.defaultTemplateId, p_recipient: recipientPayload(recipient), p_inputs: captureAppraisalInputs(listing) });
  checkAppraisalError(result.error);
  return { id: requestId };
}
export async function listWorkspaceAppraisals(supabase: SupabaseClient, agencyId: string, filters: { q: string; status: string; listing_id?: string; page: number; kind?: WorkspaceAppraisalKind }) {
  const result = await supabase.rpc("list_appraisals", { p_agency_id: agencyId, p_search: filters.q, p_status: filters.status, p_listing_id: filters.listing_id ?? null, p_page: filters.page, p_page_size: 20, p_kind: filters.kind ?? null });
  checkAppraisalError(result.error);
  return result.data as { rows: WorkspaceAppraisalRow[]; total: number; counts: Record<string, number> };
}
