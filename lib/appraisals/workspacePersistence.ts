import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/digital-proposals/errors";
import { captureAppraisalInputs } from "./workspaceInputs";
import type { Listing } from "@/lib/types";
import type { WorkspaceAppraisal } from "./workspaceTypes";
export function checkAppraisalError(error: { code?: string; message: string } | null) {
  if (error) throw new ProposalError(error.code === "PT409" ? error.message : error.code === "PT404" ? "Appraisal not found." : "Unable to save this appraisal.", error.code === "PT409" ? 409 : error.code === "PT404" ? 404 : 500);
}
export async function saveWorkspaceInputs(supabase: SupabaseClient, appraisal: WorkspaceAppraisal, listing: Listing, expected: string) {
  // updated_at is a concurrency token, not input content.
  const snapshot = captureAppraisalInputs({ ...listing, updated_at: appraisal.inputs_json?.listing.updated_at ?? listing.updated_at });
  const result = await supabase.rpc("save_appraisal_inputs", { p_agency_id: appraisal.agency_id, p_report_id: appraisal.report_id, p_expected_updated_at: expected, p_inputs: snapshot });
  checkAppraisalError(result.error);
  return result.data as WorkspaceAppraisal;
}
