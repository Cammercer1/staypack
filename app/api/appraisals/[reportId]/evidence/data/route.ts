import { requireAppraisalAccess, requireEditableAppraisal, saveWorkspaceInputs } from "@/lib/appraisals/workspace";
import { appraisalListing, appraisalEvidenceSchema, editAppraisalEvidence } from "@/lib/appraisals/workspaceInputs";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
import { ProposalError } from "@/lib/digital-proposals/errors";
export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try { const context = await requireAppraisalAccess((await params).reportId); const kind = requireEditableAppraisal(context);
    const body = appraisalEvidenceSchema.parse(await proposalRequest(request));
    let listing; try { listing = editAppraisalEvidence(context.workingListing, kind, body); } catch(error) { throw new ProposalError(error instanceof Error ? error.message : "Invalid evidence."); }
    const appraisal = await saveWorkspaceInputs(context.supabase, context.appraisal, listing, body.expected_updated_at);
    return privateJson({ appraisal, listing: appraisalListing(context.listing, appraisal) });
  } catch (error) { return proposalApiError(error); }
}
