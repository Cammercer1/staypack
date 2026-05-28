"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddListingAgentDialog } from "@/components/reports/ListingAgentsEditor";
import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import {
  EMPTY_LISTING_AGENT,
  initialListingAgents,
  listingAgentAlreadyAttached,
  listingAgentsToParsed,
  type ListingAgentDraft,
} from "@/lib/reports/listingAgents";
import type { AgentProfile, Listing } from "@/lib/types";

type Props = {
  listing: Listing;
  onUpdated: (listing: Listing) => void;
};

function MinimalAgentCard({
  agent,
  onEdit,
  onRemove,
}: {
  agent: ListingAgentDraft;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const subtitle =
    agent.role_title || agent.phone || agent.email || "Listing agent";

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 py-1.5 pr-1.5 pl-2">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {agent.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.photo_url}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {agent.name.trim().charAt(0) || "?"}
          </div>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {agent.name.trim() || "Unnamed agent"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label={`Remove ${agent.name || "agent"}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ListingAgentEditDialog({
  agent,
  open,
  onClose,
  onSave,
}: {
  agent: ListingAgentDraft | null;
  open: boolean;
  onClose: () => void;
  onSave: (agent: ListingAgentDraft) => void;
}) {
  const [draft, setDraft] = useState<ListingAgentDraft>(EMPTY_LISTING_AGENT);

  useEffect(() => {
    if (open && agent) {
      setDraft(agent);
    }
  }, [open, agent]);

  function updateField(field: keyof ListingAgentDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit listing agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="strip-agent-name">Name</Label>
            <Input
              id="strip-agent-name"
              value={draft.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Agent name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="strip-agent-role">Role title</Label>
            <Input
              id="strip-agent-role"
              value={draft.role_title}
              onChange={(event) => updateField("role_title", event.target.value)}
              placeholder="Sales Consultant"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="strip-agent-phone">Phone</Label>
            <Input
              id="strip-agent-phone"
              value={draft.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="0400 000 000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="strip-agent-email">Email</Label>
            <Input
              id="strip-agent-email"
              type="email"
              value={draft.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="agent@agency.com.au"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="strip-agent-photo">Photo URL</Label>
            <Input
              id="strip-agent-photo"
              value={draft.photo_url}
              onChange={(event) => updateField("photo_url", event.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
          >
            Save agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ListingAgentsStrip({ listing, onUpdated }: Props) {
  const [agents, setAgents] = useState<ListingAgentDraft[]>(() =>
    initialListingAgents(listing.scraped_listing_json?.agents),
  );
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAgents(initialListingAgents(listing.scraped_listing_json?.agents));
  }, [listing.id, listing.updated_at]);

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => response.json())
      .then((payload) => setAgencyAgents(payload.agents ?? []))
      .catch(() => {
        // Non-blocking — manual agent entry still works.
      });
  }, []);

  async function persistAgents(nextAgents: ListingAgentDraft[]) {
    setSaving(true);

    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_agents: listingAgentsToParsed(nextAgents),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save agents");
      }

      const nextListing = payload.listing as Listing;
      const savedAgents = initialListingAgents(
        nextListing.scraped_listing_json?.agents,
      );
      setAgents(savedAgents);
      onUpdated(nextListing);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save agents",
      );
    } finally {
      setSaving(false);
    }
  }

  function openPicker() {
    if (agents.length >= MAX_LISTING_AGENTS) {
      toast.error(`You can attach up to ${MAX_LISTING_AGENTS} agents per listing`);
      return;
    }

    setPickerOpen(true);
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

    const nextAgents = [...agents, agent];
    setAgents(nextAgents);
    setPickerOpen(false);

    if (!agent.name.trim()) {
      setEditIndex(nextAgents.length - 1);
      return;
    }

    void persistAgents(nextAgents);
  }

  function removeAgent(index: number) {
    const nextAgents = agents.filter((_, agentIndex) => agentIndex !== index);
    setAgents(nextAgents);
    void persistAgents(nextAgents);
  }

  function saveEditedAgent(agent: ListingAgentDraft) {
    if (editIndex == null) {
      return;
    }

    const nextAgents = agents.map((item, index) =>
      index === editIndex ? agent : item,
    );
    setAgents(nextAgents);
    setEditIndex(null);
    void persistAgents(nextAgents);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {agents.map((agent, index) => (
          <MinimalAgentCard
            key={`listing-agent-${index}-${agent.name}`}
            agent={agent}
            onEdit={() => setEditIndex(index)}
            onRemove={() => removeAgent(index)}
          />
        ))}

        {agents.length < MAX_LISTING_AGENTS ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPicker}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
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
        onAddManual={() => appendAgent({ ...EMPTY_LISTING_AGENT })}
      />

      <ListingAgentEditDialog
        agent={editIndex != null ? agents[editIndex] : null}
        open={editIndex != null}
        onClose={() => setEditIndex(null)}
        onSave={saveEditedAgent}
      />
    </>
  );
}
