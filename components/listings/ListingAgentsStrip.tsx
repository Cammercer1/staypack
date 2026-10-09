"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Search, X, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/settings/AgentAvatar";
import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import {
  initialListingAgents,
  listingAgentAlreadyAttached,
  listingAgentFromProfile,
  listingAgentsToParsed,
  type ListingAgentDraft,
} from "@/lib/reports/listingAgents";
import type { AgentProfile, Listing } from "@/lib/types";

export function ListingAgentsStrip({
  listing,
  onUpdated,
}: {
  listing: Listing;
  onUpdated: (listing: Listing) => void;
}) {
  const assigned = initialListingAgents(listing.scraped_listing_json?.agents);
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [draft, setDraft] = useState<ListingAgentDraft[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [removed, setRemoved] = useState<ListingAgentDraft[] | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(assigned);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/agents");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Unable to load agents");
        if (!cancelled) setProfiles(payload.agents || []);
      } catch (problem) {
        if (!cancelled)
          setError(
            problem instanceof Error
              ? problem.message
              : "Unable to load agents",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);
  function launch() {
    setDraft(assigned);
    setQuery("");
    setError("");
    setRemoved(null);
    setOpen(true);
  }
  function close() {
    if (saving) return;
    if (dirty) setDiscardOpen(true);
    else setOpen(false);
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_agents: listingAgentsToParsed(draft) }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Unable to save agents");
      onUpdated(payload.listing);
      setOpen(false);
      toast.success("Listing agents updated");
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to save agents",
      );
    } finally {
      setSaving(false);
    }
  }
  const filtered = profiles.filter(
    (profile) =>
      !profile.archived_at &&
      [profile.name, profile.email, profile.phone].some((value) =>
        value?.toLowerCase().includes(query.trim().toLowerCase()),
      ),
  );
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-base-content/60">Listing agents</span>
        {assigned.map((agent, index) => (
          <button
            key={`${agent.name}-${index}`}
            onClick={launch}
            className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-base-200"
          >
            <AgentAvatar
              name={agent.name}
              src={agent.photo_url}
              className="size-8"
            />
            {agent.name}
          </button>
        ))}
        <button
          onClick={launch}
          className="du-btn du-btn-sm du-btn-ghost min-h-10"
        >
          <Users className="size-4" />
          Manage agents
        </button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          data-theme="staypack-workspace"
        >
          <DialogHeader>
            <DialogTitle>Manage listing agents</DialogTitle>
            <DialogDescription>
              Choose up to {MAX_LISTING_AGENTS} agents for this property. This
              changes the listing assignment, not their agency profiles or
              published documents.
            </DialogDescription>
          </DialogHeader>
          <section aria-label="Assigned agents" className="space-y-2">
            <h3 className="text-sm font-medium">
              Assigned · {draft.length} of {MAX_LISTING_AGENTS}
            </h3>
            {draft.map((agent, index) => (
              <div
                key={`${agent.name}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <AgentAvatar
                  name={agent.name}
                  src={agent.photo_url}
                  className="size-10"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {agent.email || agent.phone}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={saving}
                  aria-label={`Remove ${agent.name} from listing`}
                  onClick={() => {
                    setRemoved(draft);
                    setDraft(draft.filter((_, i) => i !== index));
                  }}
                >
                  <X />
                </Button>
              </div>
            ))}
            {!draft.length && (
              <p className="text-sm text-muted-foreground">
                No listing agents assigned. Reports may use the agency default.
              </p>
            )}
            {removed && (
              <button
                className="text-sm underline"
                disabled={saving}
                onClick={() => {
                  setDraft(removed);
                  setRemoved(null);
                }}
              >
                Undo removal
              </button>
            )}
          </section>
          <div className="border-t border-border pt-4">
            <label
              htmlFor="listing-agent-search"
              className="text-sm font-medium"
            >
              Find an agency agent
            </label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                id="listing-agent-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email or phone"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            {draft.length === MAX_LISTING_AGENTS && (
              <p className="mt-2 text-xs text-muted-foreground">
                Both agent spaces are filled. Remove an assigned agent to choose
                a replacement.
              </p>
            )}
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {filtered.map((profile) => {
                const agent = listingAgentFromProfile(profile);
                const attached = listingAgentAlreadyAttached(agent, draft);
                return (
                  <li key={profile.id}>
                    <button
                      disabled={
                        saving || attached || draft.length >= MAX_LISTING_AGENTS
                      }
                      onClick={() => {
                        setDraft([...draft, agent]);
                        setRemoved(null);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted disabled:opacity-50"
                    >
                      <AgentAvatar
                        name={agent.name}
                        src={agent.photo_url}
                        className="size-9"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {agent.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {agent.email || agent.phone}
                        </span>
                      </span>
                      {attached ? (
                        <span className="text-xs">Assigned</span>
                      ) : (
                        <Plus className="size-4" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {loading ? (
              <p role="status" className="text-sm">
                Loading agents…
              </p>
            ) : (
              !filtered.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  No matching agents.
                </p>
              )
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Add people or edit profile details in{" "}
              <Link
                href="/settings/agents"
                target="_blank"
                className="underline"
              >
                Agents
              </Link>
              , then reopen this panel.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button disabled={!dirty || saving} onClick={save}>
              {saving ? "Saving…" : "Save agents"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogTitle>Discard agent changes?</DialogTitle>
          <DialogDescription>
            Your listing assignments have not been saved.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                setDiscardOpen(false);
                setOpen(false);
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
