import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { privateJson } from "@/lib/str-appraisals/api";
import { ProposalError } from "./errors";
import { requestOriginAllowed } from "./requestOrigin";

export function proposalApiError(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof ProposalError) return privateJson({ error: error.message }, error.status);
  if (error instanceof ZodError) return privateJson({ error: error.issues.map(issue => issue.message).join(" ") }, 400);
  if (error instanceof Error && /^(Report|Listing|STR appraisal|Appraisal) not found$/.test(error.message)) return privateJson({ error: "Appraisal not found." }, 404);
  console.error("Proposal request failed", error instanceof Error ? error.name : "Unknown error");
  return privateJson({ error: "Unable to complete this request. Please try again." }, 500);
}
export function sameOrigin(request: Request) {
  if (!requestOriginAllowed(request)) throw new ProposalError("Request origin not allowed.", 403);
}
export async function proposalRequest(request: Request) {
  sameOrigin(request);
  if (Number(request.headers.get("content-length") ?? 0) > 256000) throw new ProposalError("Proposal is too large.", 413);
  const text = await request.text();
  if (text.length > 256000) throw new ProposalError("Proposal is too large.", 413);
  try { return JSON.parse(text); } catch { throw new ProposalError("Invalid request."); }
}
