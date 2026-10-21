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
    const admin = createAdminClient();
    let query = admin.from("digital_proposal_links").update({ revoked_at: revokedAt })
      .eq("agency_id", context.agency.id).eq("report_id", context.report.id).is("revoked_at", null).select("id,revoked_at");
    // A stable link may have advanced since this screen loaded. Revoke its identity.
    query = linkId ? query.eq("id", linkId) : query.eq("version_id", versionId);
    const result = await query;
    if (result.error) throw new ProposalError("Unable to revoke the share link. Please try again.", 503);
    if (result.data?.length) return privateJson({ revokedAt: result.data[0].revoked_at });
    // Another tab may have revoked it while the conditional update waited for its row lock.
    // Return that original receipt without attempting to change an immutable revocation.
    let existing = admin.from("digital_proposal_links").select("id,revoked_at")
      .eq("agency_id", context.agency.id).eq("report_id", context.report.id).not("revoked_at", "is", null);
    existing = linkId ? existing.eq("id", linkId) : existing.eq("version_id", versionId);
    const previous = await existing.order("revoked_at", { ascending: false }).limit(1);
    if (previous.error) throw new ProposalError("Unable to revoke the share link. Please try again.", 503);
    if (!previous.data?.length) throw new ProposalError("Share link not found.", 404);
    return privateJson({ revokedAt: previous.data[0].revoked_at });
  } catch (error) { return proposalApiError(error); }
}
