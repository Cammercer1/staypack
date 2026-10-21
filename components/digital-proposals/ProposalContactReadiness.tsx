import type { UseFormReturn } from "react-hook-form";
import { Mail } from "lucide-react";
import type { ProposalAgentOption } from "@/lib/digital-proposals/agents";
import { agencyContactActions, hasAgentContact } from "@/lib/digital-proposals/contacts";
import type { ProposalData } from "@/lib/digital-proposals/data";
import { isSafeProposalUrl } from "@/lib/digital-proposals/links";
import type { ProposalDraft } from "@/lib/digital-proposals/template";
import { ProposalAgentPicker } from "./ProposalAgentPicker";

export function ProposalContactReadiness({ data, draft, form, agents, disabled, onRefresh }: {
  data: ProposalData; draft: ProposalDraft; form: UseFormReturn<ProposalDraft>;
  agents: ProposalAgentOption[]; disabled?: boolean; onRefresh?: () => void;
}) {
  const nextStepsIndex = draft.pages.findIndex(page => page.kind === "next_steps");
  const hasNextSteps = nextStepsIndex >= 0 && draft.pages[nextStepsIndex].enabled;
  const agentContact = hasAgentContact(data.agents);
  const agencyActions = agencyContactActions(data.agency);
  const hasLink = draft.links.some(link => isSafeProposalUrl(link.url));
  const hasResponse = agentContact || agencyActions.length > 0 || hasLink;
  const ready = hasNextSteps && hasResponse;

  return <section aria-label="Client response options" className="space-y-4">
    <div className="du-card border border-base-300 bg-base-100">
      <div className="du-card-body gap-3 p-5 sm:p-6">
        <h3 className="du-card-title text-base"><Mail size={18} aria-hidden="true" />How clients can respond</h3>
        {ready ? <p className="text-sm leading-relaxed text-base-content/75 [overflow-wrap:anywhere]">{agentContact
          ? "Your selected agent’s contact details will appear on the Next steps page."
          : agencyActions.length ? `Your agency’s contact details will appear on the Next steps page: ${agencyActions.map(action => action.value).join(" · ")}.`
            : "Your action links will appear on the Next steps page."}</p>
          : <p role="status" className="du-alert border-warning/30 bg-warning/20 text-base-content text-sm leading-relaxed">{!hasResponse
            ? "Add a way for clients to respond before sharing. Choose an agent with a phone number or email, or add your agency’s contact details. You can still publish without them."
            : "Your contact details and action links are hidden because the Next steps page is not included."}</p>}
        {!hasNextSteps && nextStepsIndex >= 0 && <button type="button" className="du-btn du-btn-sm min-h-11 w-full sm:w-fit" disabled={disabled} onClick={() => form.setValue(`pages.${nextStepsIndex}.enabled`, true, { shouldDirty: true })}>Include Next steps page</button>}
        {!agentContact && <>
          <a href="/settings/agency" target="_blank" rel="noreferrer" className="w-fit text-sm underline underline-offset-4">{agencyActions.length ? "Edit agency contact details" : "Add agency contact details"}<span className="sr-only"> (opens in a new tab)</span></a>
          {onRefresh && <><p className="text-xs text-base-content/65">After saving changes in settings, refresh these details before publishing.</p><button type="button" disabled={disabled} className="du-btn du-btn-sm min-h-11 w-full sm:w-fit" onClick={onRefresh}>Refresh contact details</button></>}
        </>}
      </div>
    </div>
    {!hasResponse && <ProposalAgentPicker form={form} selected={draft.agentIds ?? []} agents={agents} disabled={disabled} />}
  </section>;
}
