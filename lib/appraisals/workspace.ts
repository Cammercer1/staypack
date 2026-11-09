import { assertPropertyCountry } from "@/lib/property-market/agencyCountry";
import { checkAppraisalError } from "./workspacePersistence";
export { checkAppraisalError, saveWorkspaceInputs } from "./workspacePersistence";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/digital-proposals/errors";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { createStrAppraisal } from "@/lib/str-appraisals/service";
import { recipientPayload, type RecipientValues } from "@/lib/str-appraisals/validation";
import { captureAppraisalInputs } from "./workspaceInputs";
import type { Agency, Listing } from "@/lib/types";
import type { WorkspaceAppraisalKind } from "./workspaceTypes";
import { requireAppraisalAccess } from "./access";
export { requireAppraisalAccess } from "./access";
export { listWorkspaceAppraisals } from "./list";

export function requireEditableAppraisal(context: Awaited<ReturnType<typeof requireAppraisalAccess>>) {
  assertPropertyCountry(context.agency, context.workingListing);
  if (context.appraisal.kind === "str") throw new ProposalError("Use the short-term rental editor for this appraisal.");
  if (context.report.status === "archived" || context.listing.status === "archived") throw new ProposalError("Restore this appraisal and its property before editing.", 409);
  return context.appraisal.kind;
}
export async function createWorkspaceAppraisal({ supabase, agency, listing, requestId, recipient, kind }: {
  supabase: SupabaseClient; agency: Agency; listing: Listing; requestId: string; recipient: RecipientValues; kind: WorkspaceAppraisalKind;
}) {
  assertPropertyCountry(agency, listing);
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
