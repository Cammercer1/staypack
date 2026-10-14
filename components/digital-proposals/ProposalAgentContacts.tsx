import { AgentAvatar } from "@/components/settings/AgentAvatar";
import { Mail, Phone } from "lucide-react";
import type { ProposalAgent } from "@/lib/digital-proposals/data";

export function ProposalAgentContacts({ agents }: { agents: ProposalAgent[] }) {
  if (!agents.length) return null;
  const contactLink = "inline-flex size-11 items-center justify-center rounded-full text-(--proposal-muted) transition-colors hover:bg-(--proposal-surface) hover:text-(--proposal-text) focus-visible:outline-2 focus-visible:outline-offset-2";
  return <section aria-label="Your contacts">
    <ul className="flex flex-wrap gap-x-8 gap-y-3">
      {agents.map((agent, index) => <li key={index} className="flex min-w-0 max-w-full items-center gap-3">
        <AgentAvatar name={agent.name} src={agent.photoUrl} className="size-9 bg-(--proposal-surface) text-xs text-(--proposal-text) ring-0" />
        <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{agent.name}</span>
        {(agent.phone || agent.email) && <div className="flex shrink-0">
          {agent.email && <a href={`mailto:${encodeURIComponent(agent.email)}`} aria-label={`Email ${agent.name}`} title={agent.email} className={contactLink}><Mail size={16} aria-hidden="true" /></a>}
          {agent.phone && <a href={`tel:${agent.phone.replace(/[^+\d]/g, "")}`} aria-label={`Call ${agent.name}`} title={agent.phone} className={contactLink}><Phone size={16} aria-hidden="true" /></a>}
        </div>}
      </li>)}
    </ul>
  </section>;
}
