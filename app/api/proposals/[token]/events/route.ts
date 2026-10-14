import { createAdminClient } from "@/lib/supabase/admin";
import { allowedProposalEvent, isAutomatedProposalRequest, proposalEventSchema } from "@/lib/digital-proposals/activity";
import { publishedProposal } from "@/lib/digital-proposals/published";
import { proposalRequest, proposalApiError } from "@/lib/digital-proposals/http";
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (isAutomatedProposalRequest(request.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
    const event = proposalEventSchema.parse(await proposalRequest(request));
    const { token } = await params;
    const version = await publishedProposal(token);
    if (allowedProposalEvent(event, version.snapshot)) {
      const result = await createAdminClient().rpc("record_proposal_event", { p_token: token, p_id: event.id, p_session: event.session, p_kind: event.kind, p_target: event.target });
      if (result.error) return new Response(null, { status: 503 });
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return proposalApiError(error); }
}
