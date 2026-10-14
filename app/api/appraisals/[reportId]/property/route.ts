import { z } from "zod";
import { requireAppraisalAccess, requireEditableAppraisal, saveWorkspaceInputs } from "@/lib/appraisals/workspace";
import { appraisalListing, appraisalPropertySchema } from "@/lib/appraisals/workspaceInputs";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try { const context = await requireAppraisalAccess((await params).reportId); requireEditableAppraisal(context);
    const body = z.object({ expected_updated_at: z.iso.datetime({ offset: true }), property: appraisalPropertySchema }).strict().parse(await proposalRequest(request));
    const appraisal = await saveWorkspaceInputs(context.supabase, context.appraisal, { ...context.workingListing, ...body.property }, body.expected_updated_at);
    return privateJson({ appraisal, listing: appraisalListing(context.listing, appraisal) });
  } catch (error) { return proposalApiError(error); }
}
