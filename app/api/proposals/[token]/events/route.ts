import { createAdminClient } from "@/lib/supabase/admin";
import { allowedProposalEvent, isAutomatedProposalRequest, proposalEventSchema } from "@/lib/digital-proposals/activity";
import { publishedProposal } from "@/lib/digital-proposals/published";
import { proposalRequest, proposalApiError } from "@/lib/digital-proposals/http";
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (isAutomatedProposalRequest(request.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
    const event = proposalEventSchema.parse(await proposalRequest(request));
    const { token } = await params;
    const version = await publishedProposal(token, event.versionId);
    // An older open page cannot identify its snapshot after a stable link moves.
    if (!event.versionId && !version.legacy) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    if (allowedProposalEvent(event, version.snapshot)) {
      const args = { p_token: token, p_id: event.id, p_session: event.session, p_kind: event.kind, p_target: event.target };
      const result = version.legacy
        ? await createAdminClient().rpc("record_proposal_event", args)
        : await createAdminClient().rpc("record_proposal_event_v2", { ...args, p_version_id: version.id });
      if (result.error) return new Response(null, { status: 503 });
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return proposalApiError(error); }
}
