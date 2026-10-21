import { after } from "next/server";
import { publishedProposal } from "@/lib/digital-proposals/published";
import { z } from "zod";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalContext, publishProposal } from "@/lib/digital-proposals/server";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const context = await proposalContext((await params).reportId, request);
    const body = z.object({ revision: z.number().int().positive(), sourceFingerprint: z.string().length(64) }).strict().parse(await proposalRequest(request));
    const result = await publishProposal(context, body.revision, body.sourceFingerprint);
    // Fill the server cache before the first recipient visits. Never record viewer events here.
    after(async () => {
      try { await publishedProposal(result.shareLink.path.split("/").pop()!, result.version.id); }
      catch { console.warn("Proposal cache warm-up deferred to first visit"); }
    });
    return privateJson(result);
  } catch (error) { return proposalApiError(error); }
}
