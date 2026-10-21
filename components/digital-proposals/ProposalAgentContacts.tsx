import { AgentAvatar } from "@/components/settings/AgentAvatar";
import { Mail, Phone } from "lucide-react";
import type { ProposalAgent } from "@/lib/digital-proposals/data";
import { contactActions } from "@/lib/digital-proposals/contacts";

export function ProposalAgentContacts({ agents }: { agents: ProposalAgent[] }) {
  if (!agents.length) return null;
  const contactLink = "inline-flex size-11 items-center justify-center rounded-full text-(--proposal-muted) transition-colors hover:bg-(--proposal-surface) hover:text-(--proposal-text) focus-visible:outline-2 focus-visible:outline-offset-2";
  return <section aria-label="Your contacts">
    <ul className="flex flex-wrap gap-x-8 gap-y-3">
      {agents.map((agent, index) => <li key={index} className="flex min-w-0 max-w-full items-center gap-3">
        <AgentAvatar name={agent.name} src={agent.photoUrl} className="size-9 bg-(--proposal-surface) text-xs text-(--proposal-text) ring-0" />
        <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{agent.name}</span>
        {contactActions(agent).length > 0 && <div className="flex shrink-0">
          {contactActions(agent).map(action => <a key={action.href} href={action.href} aria-label={action.label} title={action.value} className={contactLink}>{action.href.startsWith("mailto:") ? <Mail size={16} aria-hidden="true" /> : <Phone size={16} aria-hidden="true" />}</a>)}
        </div>}
      </li>)}
    </ul>
  </section>;
}
