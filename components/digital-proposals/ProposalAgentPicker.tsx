"use client";
import { useId, useState } from "react";
import { Check, Plus, Search, Users, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { AgentAvatar } from "@/components/settings/AgentAvatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import type { ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalAgentOption } from "@/lib/digital-proposals/agents";
import { cn } from "@/lib/utils";

export function ProposalAgentPicker({ form, selected, agents, disabled = false }: {
  form: UseFormReturn<ProposalDraft>;
  selected: string[];
  agents: ProposalAgentOption[];
  disabled?: boolean;
}) {
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const matching = agents.filter(agent => [agent.name, agent.role, agent.email, agent.phone].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())));
  const unavailable = pending.filter(id => !agents.some(agent => agent.id === id));
  const changed = pending.length !== selected.length || pending.some((id, index) => id !== selected[index]);

  function launch() {
    if (disabled) return;
    setPending([...selected]);
    setSearch("");
    setOpen(true);
  }
  function toggle(id: string, checked: boolean) {
    if (disabled) return;
    setPending(current => checked
      ? current.includes(id) || current.length >= MAX_LISTING_AGENTS ? current : [...current, id]
      : current.filter(item => item !== id));
  }
  function apply() {
    if (disabled || pending.length > MAX_LISTING_AGENTS || unavailable.length) return;
    form.setValue("agentIds", pending, { shouldDirty: true });
    setOpen(false);
  }

  return <>
    <section aria-label="Proposal agents" className="space-y-4 rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Your agents</h3>
          <p className="mt-1 text-xs leading-relaxed text-base-content/60">Add the people presenting this proposal.</p>
        </div>
        <span className="shrink-0 rounded-full bg-base-200 px-2.5 py-1 text-xs font-medium tabular-nums text-base-content/65">{selected.length} / {MAX_LISTING_AGENTS}</span>
      </div>
      {selected.length ? <ul className="space-y-2">
        {selected.map(id => {
          const agent = agents.find(item => item.id === id);
          return <li key={id} className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-3">
            <AgentAvatar name={agent?.name ?? "Unavailable agent"} src={agent?.photoUrl} className="size-10 bg-base-200 text-base-content ring-base-300" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{agent?.name ?? "Unavailable agent"}</p>
              <p className={cn("mt-0.5 break-words text-xs", agent ? "text-base-content/60" : "text-error")}>{agent ? agent.role || "Proposal agent" : "Remove this agent to continue."}</p>
            </div>
            <button type="button" disabled={disabled} aria-label={`Remove ${agent?.name ?? "unavailable agent"} from proposal`} className="du-btn du-btn-ghost du-btn-square du-btn-sm size-9 shrink-0 text-base-content/55 hover:text-base-content" onClick={() => form.setValue("agentIds", selected.filter(item => item !== id), { shouldDirty: true })}>
              <X size={16} aria-hidden="true" />
            </button>
          </li>;
        })}
      </ul> : <div className="flex items-center gap-3 rounded-xl border border-dashed border-base-300 bg-base-200/35 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-base-200 text-base-content/55"><Users size={18} aria-hidden="true" /></span>
        <div><p className="text-sm font-medium">No agents added</p><p className="mt-0.5 text-xs text-base-content/60">Choose up to {MAX_LISTING_AGENTS} from your team.</p></div>
      </div>}
      <button type="button" disabled={disabled} onClick={launch} className="du-btn du-btn-sm min-h-11 w-full rounded-xl border-base-300 bg-base-100 font-medium shadow-none hover:bg-base-200">
        <Plus size={16} aria-hidden="true" />Choose agents
      </button>
    </section>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-theme="staypack-workspace" showCloseButton={false} className="inset-x-0 top-auto bottom-0 flex max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl bg-base-100 p-0 text-base-content sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:w-[calc(100%-3rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-base-300 p-5 sm:px-6">
          <div>
            <DialogTitle className="text-lg font-semibold">Choose proposal agents</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-base-content/60">Select up to {MAX_LISTING_AGENTS} agents to appear on this proposal.</DialogDescription>
          </div>
          <button type="button" aria-label="Close agent chooser" onClick={() => setOpen(false)} className="du-btn du-btn-ghost du-btn-square du-btn-sm size-9 shrink-0"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="space-y-3 px-5 pt-5 sm:px-6">
          <label htmlFor={searchId} className="du-input flex min-h-11 w-full items-center gap-2 rounded-xl border-base-300 bg-base-100">
            <Search size={17} className="shrink-0 text-base-content/45" aria-hidden="true" />
            <span className="sr-only">Search agents</span>
            <input id={searchId} type="search" value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} placeholder="Search your team" className="min-w-0 grow" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p role="status" className="font-medium text-base-content/65">{pending.length} of {MAX_LISTING_AGENTS} selected</p>
            <a href="/settings/agents" target="_blank" rel="noreferrer" className="underline underline-offset-4">Manage team{" "}<span className="sr-only">(opens in a new tab)</span></a>
          </div>
          {pending.length >= MAX_LISTING_AGENTS && <p className="rounded-lg bg-base-200 px-3 py-2 text-xs leading-relaxed text-base-content/65">All agent spaces are filled. Deselect an agent to choose someone else.</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <ul className="space-y-2" aria-label="Agency agents">
            {unavailable.map(id => <li key={id} className="flex items-center justify-between gap-3 rounded-xl border border-error/25 bg-error/5 p-3">
              <div><p className="text-sm font-medium">Unavailable agent</p><p className="mt-1 text-xs text-base-content/65">Remove this agent before updating.</p></div>
              <button type="button" aria-label="Remove unavailable agent" disabled={disabled} onClick={() => toggle(id, false)} className="du-btn du-btn-sm du-btn-ghost text-error">Remove</button>
            </li>)}
            {matching.map(agent => {
              const checked = pending.includes(agent.id);
              return <li key={agent.id}>
                <label className={cn("flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-disabled:cursor-default has-disabled:opacity-45", checked ? "border-primary/35 bg-primary/5" : "border-base-300 hover:bg-base-200/60")}>
                  <AgentAvatar name={agent.name} src={agent.photoUrl} className="size-11 bg-base-200 text-base-content ring-base-300" loading="lazy" />
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{agent.name}</span>{agent.role && <span className="mt-1 block break-words text-xs text-base-content/60">{agent.role}</span>}</span>
                  <span className="relative flex size-5 shrink-0 items-center justify-center">
                    <input type="checkbox" className="peer size-5 appearance-none rounded-md border border-base-content/25 bg-base-100 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label={`Attach ${agent.name}`} checked={checked} disabled={disabled || (!checked && pending.length >= MAX_LISTING_AGENTS)} onChange={event => toggle(agent.id, event.target.checked)} />
                    <Check size={14} strokeWidth={3} aria-hidden="true" className="pointer-events-none absolute text-primary-content opacity-0 peer-checked:opacity-100" />
                  </span>
                </label>
              </li>;
            })}
          </ul>
          {!matching.length && <div className="py-8 text-center">
            <Users size={24} className="mx-auto mb-3 text-base-content/35" aria-hidden="true" />
            <p className="text-sm font-medium">{agents.length ? "No matching agents" : "Your team starts here"}</p>
            <p className="mt-1 text-xs leading-relaxed text-base-content/60">{agents.length ? "Try another name, role or email." : "Add agents in your team settings to include them in proposals."}</p>
          </div>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-300 bg-base-200/35 p-4 sm:px-6">
          <button type="button" onClick={() => setOpen(false)} className="du-btn du-btn-sm du-btn-ghost min-h-11">Cancel</button>
          <button type="button" disabled={disabled || !changed || pending.length > MAX_LISTING_AGENTS || unavailable.length > 0} onClick={apply} className="du-btn du-btn-sm du-btn-primary min-h-11 px-5"><Check size={16} aria-hidden="true" />{selected.length ? "Update agents" : "Add agents"}</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
