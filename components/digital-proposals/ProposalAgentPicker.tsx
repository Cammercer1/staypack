"use client";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { AgentAvatar } from "@/components/settings/AgentAvatar";
import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import type { ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalAgentOption } from "@/lib/digital-proposals/agents";

export function ProposalAgentPicker({ form, selected, agents }: {
  form: UseFormReturn<ProposalDraft>; selected: string[]; agents: ProposalAgentOption[];
}) {
  const [search, setSearch] = useState("");
  const matching = agents.filter(agent => `${agent.name} ${agent.role}`.toLowerCase().includes(search.trim().toLowerCase()));
  const setSelected = (id: string, checked: boolean) => form.setValue("agentIds", checked ? [...selected, id] : selected.filter(item => item !== id), { shouldDirty: true });
  const unavailable = selected.filter(id => !agents.some(agent => agent.id === id));
  return <section aria-label="Proposal agents" className="space-y-3 border-t border-base-300 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Agents</h3><a href="/settings/agents" target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">Manage agents<span className="sr-only"> (opens in a new tab)</span></a></div>
    <p className="text-xs text-base-content/65">Choose up to {MAX_LISTING_AGENTS} agents for this proposal.</p>
    {!agents.length && <p className="text-sm">Add an agent to your account to attach them here.</p>}
    {agents.length > 6 && <input type="search" aria-label="Search agents" placeholder="Search agents" value={search} onChange={event => setSearch(event.target.value)} className="du-input du-input-sm min-h-11 w-full" />}
    <div className="max-h-72 space-y-2 overflow-y-auto">
      {matching.map(agent => <label key={agent.id} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-3 has-checked:bg-base-200 has-disabled:opacity-50">
        <input type="checkbox" className="du-checkbox du-checkbox-sm shrink-0" aria-label={`Attach ${agent.name}`} checked={selected.includes(agent.id)} disabled={!selected.includes(agent.id) && selected.length >= MAX_LISTING_AGENTS} onChange={event => setSelected(agent.id, event.target.checked)} />
        <AgentAvatar name={agent.name} src={agent.photoUrl} className="size-10" loading="lazy" />
        <span className="min-w-0 text-sm"><span className="block break-words font-medium">{agent.name}</span>{agent.role && <span className="mt-0.5 block break-words text-xs text-base-content/65">{agent.role}</span>}</span>
      </label>)}
      {agents.length > 0 && !matching.length && <p role="status" className="py-2 text-sm">No matching agents.</p>}
      {unavailable.map(id => <label key={id} className="flex items-center gap-3 rounded-lg border border-base-300 p-3 text-sm"><input type="checkbox" className="du-checkbox du-checkbox-sm" checked onChange={() => setSelected(id, false)} />Unavailable agent — remove to continue</label>)}
    </div>
  </section>;
}
