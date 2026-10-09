"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Search,
  Star,
  UserPlus,
  Users,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { AgentProfileForm } from "./AgentProfileForm";
import { AgentAvatar } from "./AgentAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  filterAgentDirectory,
  findDuplicateAgents,
  type AgentDirectoryEntry,
} from "@/lib/agents/directory";
import type { AgentProfile } from "@/lib/types";

export function AgentsManager({
  canManage = true,
  initialAgents,
}: {
  canManage?: boolean;
  initialAgents: AgentDirectoryEntry[];
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("az");
  const [selected, setSelected] = useState<AgentDirectoryEntry | "new" | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [archiveTarget, setArchiveTarget] =
    useState<AgentDirectoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const filtered = useMemo(
    () => filterAgentDirectory(agents, search, status, sort),
    [agents, search, status, sort],
  );
  const duplicateCount = agents.filter(
    (agent) =>
      !agent.archived_at &&
      findDuplicateAgents(agent, agents, agent.id).length > 0,
  ).length;
  const selectedAgent = selected && selected !== "new" ? selected : undefined;
  const onStateChange = useCallback((isDirty: boolean, isBusy: boolean) => {
    setDirty(isDirty);
    setBusy(isBusy);
  }, []);
  const close = useCallback(() => {
    setSelected(null);
    setDirty(false);
    setBusy(false);
    setError(null);
  }, []);
  const requestAction = useCallback(
    (action: () => void) => {
      if (busy || actionBusy) return;
      if (dirty) setPending(() => action);
      else action();
    },
    [busy, actionBusy, dirty],
  );

  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      event.preventDefault();
      event.stopPropagation();
      requestAction(() => {
        setDirty(false);
        window.location.assign(link.href);
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, busy, requestAction]);

  async function refresh() {
    try {
      const response = await fetch("/api/agents?directory=true");
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.agents)) throw new Error();
      setAgents(payload.agents);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }
  function saved(agent: AgentProfile) {
    setAgents((current) => {
      const without = current
        .filter((item) => item.id !== agent.id)
        .map((item) =>
          agent.is_default ? { ...item, is_default: false } : item,
        );
      return [
        ...without,
        {
          ...agent,
          listings:
            current.find((item) => item.id === agent.id)?.listings ?? [],
        },
      ];
    });
    close();
    toast.success(selected === "new" ? "Agent added" : "Agent saved");
    void refresh();
  }
  async function perform(
    agent: AgentDirectoryEntry,
    action: "default" | "archive" | "restore",
  ) {
    setActionBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          action,
          updated_at: agent.updated_at,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.agent)
        throw new Error(
          payload?.error || "Could not update this agent. Please try again.",
        );
      setAgents((current) =>
        current.map((item) =>
          item.id === agent.id
            ? { ...payload.agent, listings: item.listings }
            : action === "default"
              ? { ...item, is_default: false }
              : item,
        ),
      );
      setArchiveTarget(null);
      close();
      toast.success(
        action === "archive"
          ? "Agent archived. You can restore them from Archived."
          : action === "restore"
            ? "Agent restored"
            : `${agent.name} is now the default agent`,
      );
      void refresh();
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Please try again.",
      );
    } finally {
      setActionBusy(false);
    }
  }
  function open(agent: AgentDirectoryEntry | "new") {
    setSelected(agent);
    setError(null);
    setDirty(false);
    setBusy(false);
  }
  return (
    <div data-theme="staypack-workspace" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          Agent profiles are used on your branded material. Adding a profile
          does not invite someone to your workspace.
        </p>
        {canManage && (
          <button
            type="button"
            className="du-btn du-btn-primary shrink-0"
            onClick={() => open("new")}
          >
            <UserPlus className="size-4" />
            Add agent
          </button>
        )}
      </div>
      <section
        className="overflow-hidden rounded-2xl border border-base-300 bg-base-100"
        aria-label="Agent directory"
      >
        <div className="grid gap-3 border-b border-base-300 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:p-5">
          <label className="du-input w-full">
            <Search className="size-4 shrink-0" />
            <input
              type="search"
              aria-label="Search agents"
              placeholder="Search name, email, phone or role"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Agent status"
            className="du-select w-full sm:w-40"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="active">Active agents</option>
            <option value="archived">Archived agents</option>
            <option value="all">All agents</option>
            <option value="duplicates">Possible duplicates</option>
          </select>
          <select
            aria-label="Sort agents"
            className="du-select w-full sm:w-36"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="az">Name A–Z</option>
            <option value="za">Name Z–A</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
          <span role="status">
            {filtered.length} {filtered.length === 1 ? "agent" : "agents"}
            {search ? ` matching “${search}”` : ""}
          </span>
          {duplicateCount > 0 && (
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => {
                setStatus("duplicates");
                setSearch("");
              }}
            >
              Review {duplicateCount} possible duplicates
            </button>
          )}
        </div>
        {refreshError && (
          <div
            role="alert"
            className="m-4 rounded-xl border border-base-300 p-3 text-sm"
          >
            Your last change was saved, but the directory could not refresh.{" "}
            <button type="button" className="underline" onClick={refresh}>
              Retry refresh
            </button>
          </div>
        )}
        {error && !selected && !archiveTarget && (
          <p role="alert" className="px-5 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {filtered.length ? (
          <ul className="du-list divide-y divide-base-300">
            {filtered.map((agent, index) => (
              <li
                key={agent.id}
                className="du-list-row items-center gap-4 rounded-none px-5 py-5"
              >
                <AgentAvatar
                  name={agent.name}
                  src={agent.photo_url}
                  loading={index < 5 ? "eager" : "lazy"}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-base font-medium">
                      {agent.name}
                    </h2>
                    {agent.is_default && (
                      <span className="du-badge du-badge-sm du-badge-soft">
                        <Star className="size-3" />
                        Default
                      </span>
                    )}
                    {agent.archived_at && (
                      <span className="du-badge du-badge-sm du-badge-ghost">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {agent.role_title || "Agent"}
                  </p>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {[agent.email, agent.phone].filter(Boolean).join(" · ") ||
                      "No contact details added"}
                  </p>
                </div>
                <button
                  type="button"
                  className="du-btn du-btn-sm du-btn-outline min-h-10"
                  aria-label={`${canManage && !agent.archived_at ? "Edit" : "View"} ${agent.name}`}
                  onClick={() => open(agent)}
                >
                  {canManage && !agent.archived_at ? "Edit" : "View"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto mb-3 size-7 text-muted-foreground" />
            <h2 className="font-medium">
              {search
                ? "No matching agents"
                : status === "archived"
                  ? "No archived agents"
                  : status === "duplicates"
                    ? "No possible duplicates"
                    : "Your agents will appear here"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Try a different name or contact detail."
                : "Create profiles once, then use them across your listings and reports."}
            </p>
            {(search || status !== "active") && (
              <button
                type="button"
                className="du-btn du-btn-ghost mt-4"
                onClick={() => {
                  setSearch("");
                  setStatus("active");
                }}
              >
                Show active agents
              </button>
            )}
          </div>
        )}
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(next) => {
          if (!next) requestAction(close);
        }}
      >
        <DialogContent
          data-theme="staypack-workspace"
          showCloseButton={!busy && !actionBusy}
          className="inset-y-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-xl"
        >
          <DialogHeader className="shrink-0 border-b border-base-300 px-5 py-5 pr-14 sm:px-8">
            <DialogTitle className="font-display text-2xl">
              {selected === "new"
                ? "Add agent"
                : selectedAgent?.archived_at
                  ? "Archived agent"
                  : canManage
                    ? "Edit agent"
                    : "Agent profile"}
            </DialogTitle>
            <DialogDescription>
              {selected === "new"
                ? "Create a profile for your listings and reports."
                : selectedAgent?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <details className="shrink-0 border-b border-base-300 px-5 py-3 text-sm sm:px-8">
              <summary className="cursor-pointer">
                Linked listings ({selectedAgent.listings.length})
              </summary>
              <div className="max-h-40 space-y-2 overflow-y-auto py-3">
                <p className="text-xs text-muted-foreground">
                  Contact matches may include another person with the same name.
                  Saved report details are kept separately.
                </p>
                {selectedAgent.listings.map((listing) => (
                  <Link
                    key={listing.id}
                    className="flex items-start justify-between gap-3 rounded-lg p-2 hover:bg-muted"
                    href={`/listings/${listing.id}`}
                  >
                    <span>
                      {listing.address}
                      <span className="block text-xs text-muted-foreground">
                        {listing.match === "assigned"
                          ? "Assigned agent"
                          : "Contact match"}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0" />
                  </Link>
                ))}
                {!selectedAgent.listings.length && (
                  <p>No listing assignments or matching contacts found.</p>
                )}
              </div>
            </details>
          )}
          {selected && !selectedAgent?.archived_at && canManage ? (
            <AgentProfileForm
              key={selectedAgent?.id ?? "new"}
              initial={selectedAgent}
              agents={agents}
              canEdit={!actionBusy}
              onSaved={saved}
              onStateChange={onStateChange}
              onCancel={() => requestAction(close)}
              onEditDuplicate={(agent) =>
                requestAction(() =>
                  open(
                    agents.find((entry) => entry.id === agent.id) ??
                      (agent as AgentDirectoryEntry),
                  ),
                )
              }
            />
          ) : (
            selectedAgent && (
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-8">
                <AgentAvatar
                  name={selectedAgent.name}
                  src={selectedAgent.photo_url}
                  className="size-20"
                />
                <h3 className="text-lg font-medium">{selectedAgent.name}</h3>
                <p>{selectedAgent.role_title}</p>
                <p className="break-all">{selectedAgent.email}</p>
                <p>{selectedAgent.phone}</p>
                {selectedAgent.archived_at && (
                  <p className="rounded-xl bg-muted p-4 text-sm">
                    This profile is hidden from new agent selections. Existing
                    listing assignments and saved report details remain. Restore
                    it to use it again.
                  </p>
                )}
              </div>
            )
          )}
          {error && (
            <p role="alert" className="px-5 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {selectedAgent && canManage && (
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-base-300 px-5 py-3 sm:px-8">
              {selectedAgent.archived_at ? (
                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => perform(selectedAgent, "restore")}
                >
                  <RotateCcw className="size-4" />
                  {actionBusy ? "Restoring…" : "Restore agent"}
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    disabled={dirty || busy || actionBusy}
                    onClick={() => {
                      setError(null);
                      setArchiveTarget(selectedAgent);
                    }}
                  >
                    <Archive className="size-4" />
                    Archive agent
                  </Button>
                  {!selectedAgent.is_default && (
                    <Button
                      variant="ghost"
                      disabled={dirty || busy || actionBusy}
                      onClick={() => perform(selectedAgent, "default")}
                    >
                      <Star className="size-4" />
                      {actionBusy ? "Updating…" : "Set as default"}
                    </Button>
                  )}
                </>
              )}
              {dirty && (
                <p className="w-full text-xs text-muted-foreground">
                  Save or discard edits before changing the default or
                  archiving.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!pending}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              Your agent edits have not been saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                const action = pending;
                setPending(null);
                setDirty(false);
                action?.();
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!archiveTarget}
        onOpenChange={(next) => {
          if (!next && !actionBusy) setArchiveTarget(null);
        }}
      >
        <DialogContent showCloseButton={!actionBusy}>
          <DialogHeader>
            <DialogTitle>Archive {archiveTarget?.name}?</DialogTitle>
            <DialogDescription>
              This hides the agent from new selections. Existing listing
              assignments and saved report details remain. You can restore this
              profile at any time.
              {archiveTarget?.is_default
                ? " This also clears the agency default; choose another agent afterwards."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {archiveTarget?.listings.length ?? 0} linked listings or contact
            matches.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actionBusy}
              onClick={() => setArchiveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={actionBusy}
              onClick={() => archiveTarget && perform(archiveTarget, "archive")}
            >
              {actionBusy ? "Archiving…" : "Archive agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
