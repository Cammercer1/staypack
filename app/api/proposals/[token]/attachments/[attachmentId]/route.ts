import { proposalApiError } from "@/lib/digital-proposals/http";
import { publishedProposal, ProposalError } from "@/lib/digital-proposals/published";
import { downloadProposalAttachment } from "@/lib/digital-proposals/download";
export async function GET(request: Request, { params }: { params: Promise<{ token: string; attachmentId: string }> }) {
  try {
    const { token, attachmentId } = await params;
    const version = await publishedProposal(token, new URL(request.url).searchParams.get("version") ?? undefined);
    if (!version.snapshot.attachments.some(item => item.id === attachmentId)) throw new ProposalError("Document not found.", 404);
    return await downloadProposalAttachment(version.agency_id, version.report_id, attachmentId);
  } catch (error) { return proposalApiError(error); }
}
