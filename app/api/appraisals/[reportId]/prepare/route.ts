import { z } from "zod";
import { requireAppraisalAccess } from "@/lib/appraisals/workspace";
import { prepareAppraisalDocument } from "@/lib/appraisals/prepareDocument";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try { const body = z.object({ expected_updated_at: z.iso.datetime({ offset: true }) }).strict().parse(await proposalRequest(request));
    return privateJson({ appraisal: await prepareAppraisalDocument(await requireAppraisalAccess((await params).reportId), body.expected_updated_at) });
  } catch (error) { return proposalApiError(error); }
}
