import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { createWorkspaceAppraisal, listWorkspaceAppraisals } from "@/lib/appraisals/workspace";
import { createAppraisalSchema, workspaceQuerySchema } from "@/lib/appraisals/workspaceTypes";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
export async function GET(request: Request) {
  try { const { supabase, agency } = await requireAgency(); return privateJson(await listWorkspaceAppraisals(supabase, agency.id, workspaceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)))); }
  catch (error) { return proposalApiError(error); }
}
export async function POST(request: Request) {
  try { const body = createAppraisalSchema.parse(await proposalRequest(request)); const { supabase, agency, listing } = await requireListingAccess(body.listing_id);
    return privateJson({ report: await createWorkspaceAppraisal({ supabase, agency, listing, requestId: body.request_id, recipient: body.recipient, kind: body.kind }) }); }
  catch (error) { return proposalApiError(error); }
}
