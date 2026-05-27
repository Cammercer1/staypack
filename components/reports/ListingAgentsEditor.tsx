"use client";

import { useState } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import {
  EMPTY_LISTING_AGENT,
  listingAgentAlreadyAttached,
  listingAgentFromProfile,
  type ListingAgentDraft,
} from "@/lib/reports/listingAgents";
import type { AgentProfile } from "@/lib/types";

type Props = {
  open: boolean;
  agencyAgents: AgentProfile[];
  attachedAgents: ListingAgentDraft[];
  onClose: () => void;
  onSelectProfile: (agent: ListingAgentDraft) => void;
  onAddManual: () => void;
};

export function AddListingAgentDialog({
  open,
  agencyAgents,
  attachedAgents,
  onClose,
  onSelectProfile,
  onAddManual,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add listing agent</DialogTitle>
          <DialogDescription>
            Choose someone from your agency team, or enter a new agent if they
            aren&apos;t in your account yet.
          </DialogDescription>
        </DialogHeader>

        {agencyAgents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {agencyAgents.map((profile) => {
              const draft = listingAgentFromProfile(profile);
              const alreadyAttached = listingAgentAlreadyAttached(
                draft,
                attachedAgents,
              );

              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={alreadyAttached}
                  onClick={() => {
                    onSelectProfile(draft);
                    onClose();
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 p-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {draft.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.photo_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {draft.name.charAt(0)}
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {draft.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {draft.role_title || draft.email || draft.phone || "Agent"}
                    </span>
                    {alreadyAttached ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Already on this listing
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved agents in your agency yet. You can add agents in Settings,
            or enter someone new for this listing below.
          </p>
        )}

        <div className="border-t border-border/70 pt-4">
          <Button type="button" variant="outline" className="w-full" onClick={onAddManual}>
            <Plus className="mr-2 h-4 w-4" />
            Enter new agent manually
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type EditorProps = {
  agents: ListingAgentDraft[];
  agencyAgents: AgentProfile[];
  onChange: (agents: ListingAgentDraft[]) => void;
};

function ListingAgentCard({
  agent,
  index,
  onUpdate,
  onRemove,
}: {
  agent: ListingAgentDraft;
  index: number;
  onUpdate: (patch: Partial<ListingAgentDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {agent.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.photo_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {agent.name.trim().charAt(0) || "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {agent.name.trim() || `Agent ${index + 1}`}
            </p>
            {agent.role_title ? (
              <p className="truncate text-xs text-muted-foreground">
                {agent.role_title}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove agent ${index + 1}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label htmlFor={`listing-agent-name-${index}`} className="text-xs">
            Name
          </Label>
          <Input
            id={`listing-agent-name-${index}`}
            value={agent.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            placeholder="Agent name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`listing-agent-role-${index}`} className="text-xs">
            Role title
          </Label>
          <Input
            id={`listing-agent-role-${index}`}
            value={agent.role_title}
            onChange={(event) => onUpdate({ role_title: event.target.value })}
            placeholder="Sales Consultant"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`listing-agent-phone-${index}`} className="text-xs">
            Phone
          </Label>
          <Input
            id={`listing-agent-phone-${index}`}
            value={agent.phone}
            onChange={(event) => onUpdate({ phone: event.target.value })}
            placeholder="0400 000 000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`listing-agent-email-${index}`} className="text-xs">
            Email
          </Label>
          <Input
            id={`listing-agent-email-${index}`}
            type="email"
            value={agent.email}
            onChange={(event) => onUpdate({ email: event.target.value })}
            placeholder="agent@agency.com.au"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`listing-agent-photo-${index}`} className="text-xs">
            Photo URL
          </Label>
          <Input
            id={`listing-agent-photo-${index}`}
            value={agent.photo_url}
            onChange={(event) => onUpdate({ photo_url: event.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
}

export function ListingAgentsEditor({ agents, agencyAgents, onChange }: EditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function updateAgent(index: number, patch: Partial<ListingAgentDraft>) {
    onChange(
      agents.map((agent, agentIndex) =>
        agentIndex === index ? { ...agent, ...patch } : agent,
      ),
    );
  }

  function removeAgent(index: number) {
    onChange(agents.filter((_, agentIndex) => agentIndex !== index));
  }

  function appendAgent(agent: ListingAgentDraft) {
    if (agents.length >= MAX_LISTING_AGENTS) {
      toast.error(`You can attach up to ${MAX_LISTING_AGENTS} agents per listing`);
      return;
    }

    if (listingAgentAlreadyAttached(agent, agents)) {
      toast.message("That agent is already on this listing");
      return;
    }

    onChange([...agents, agent]);
  }

  function openPicker() {
    if (agents.length >= MAX_LISTING_AGENTS) {
      toast.error(`You can attach up to ${MAX_LISTING_AGENTS} agents per listing`);
      return;
    }

    setPickerOpen(true);
  }

  function addManualAgent() {
    appendAgent({ ...EMPTY_LISTING_AGENT });
    setPickerOpen(false);
  }

  return (
    <>
      <div className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4">
        <div>
          <p className="text-sm font-medium">Listing agents</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add up to {MAX_LISTING_AGENTS} agents for this report. These appear on
            the published buyer pack footer.
          </p>
        </div>

        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents attached yet. Add someone from your team or enter a new agent.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agent, index) => (
              <ListingAgentCard
                key={`listing-agent-${index}`}
                agent={agent}
                index={index}
                onUpdate={(patch) => updateAgent(index, patch)}
                onRemove={() => removeAgent(index)}
              />
            ))}
          </div>
        )}

        {agents.length < MAX_LISTING_AGENTS ? (
          <Button type="button" variant="outline" onClick={openPicker}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add agent
          </Button>
        ) : null}
      </div>

      <AddListingAgentDialog
        open={pickerOpen}
        agencyAgents={agencyAgents}
        attachedAgents={agents}
        onClose={() => setPickerOpen(false)}
        onSelectProfile={appendAgent}
        onAddManual={addManualAgent}
      />
    </>
  );
}
