import { z } from "zod";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalContext, loadProposalWorkspace, saveProposal } from "@/lib/digital-proposals/server";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
type Context = { params: Promise<{ reportId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try { return privateJson(await loadProposalWorkspace(await proposalContext((await params).reportId))); }
  catch (error) { return proposalApiError(error); }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const context = await proposalContext((await params).reportId);
    const body = z.object({ draft: z.unknown(), revision: z.number().int().nonnegative() }).strict().parse(await proposalRequest(request));
    return privateJson(await saveProposal(context, body.draft, body.revision, process.env.NODE_ENV === "development" && new URL(request.url).searchParams.get("studio") === "1"));
  } catch (error) { return proposalApiError(error); }
}
