import { z } from "zod";
import { proposalContext } from "@/lib/digital-proposals/server";
import { proposalApiError } from "@/lib/digital-proposals/http";
import { downloadProposalAttachment } from "@/lib/digital-proposals/download";
export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string; attachmentId: string }> }) {
  try {
    const { reportId, attachmentId } = await params;
    const context = await proposalContext(reportId);
    return await downloadProposalAttachment(context.agency.id, reportId, z.uuid().parse(attachmentId));
  } catch (error) { return proposalApiError(error); }
}
