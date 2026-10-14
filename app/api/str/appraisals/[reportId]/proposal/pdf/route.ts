import { z } from "zod";
import { proposalContext } from "@/lib/digital-proposals/server";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
import { prepareProposalPdf } from "@/lib/digital-proposals/pdf";
import { privateJson } from "@/lib/str-appraisals/api";
export const maxDuration = 120;
export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const context = await proposalContext((await params).reportId);
    const { versionId } = z.object({ versionId: z.uuid() }).strict().parse(await proposalRequest(request));
    return privateJson({ status: await prepareProposalPdf(context.agency.id, context.report.id, versionId, request.url) });
  } catch (error) { return proposalApiError(error); }
}
