import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson } from "@/lib/str-appraisals/api";
import { requireProposalAppraisalAccess, ProposalError } from "@/lib/digital-proposals/server";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const context = await requireProposalAppraisalAccess((await params).reportId, request);
    const { versionId, linkId } = z.object({ versionId: z.uuid(), linkId: z.uuid().optional() }).strict().parse(await proposalRequest(request));
    const revokedAt = new Date().toISOString();
    let query = createAdminClient().from("digital_proposal_links").update({ revoked_at: revokedAt })
      .eq("version_id", versionId).eq("agency_id", context.agency.id).eq("report_id", context.report.id).select("id");
    if (linkId) query = query.eq("id", linkId);
    const result = await query;
    if (result.error || !result.data?.length) throw new ProposalError("Share link not found.", 404);
    return privateJson({ revokedAt });
  } catch (error) { return proposalApiError(error); }
}
