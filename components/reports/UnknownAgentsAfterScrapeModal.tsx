"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedListing } from "@/lib/types";

type UnknownAgent = ParsedListing["agents"][number] & { name: string };

type AgentDraft = {
  name: string;
  email: string;
  phone: string;
  role_title: string;
  photo_url: string;
  is_default: boolean;
};

type Props = {
  open: boolean;
  agents: UnknownAgent[];
  onComplete: () => void;
};

function toDraft(agent: UnknownAgent): AgentDraft {
  return {
    name: agent.name,
    email: agent.email ?? "",
    phone: agent.phone ?? "",
    role_title: agent.role_title ?? "",
    photo_url: agent.photo_url ?? "",
    is_default: false,
  };
}

function allAgentsHandled(
  agentList: UnknownAgent[],
  savedNames: Set<string>,
  skippedNames: Set<string>,
) {
  return agentList.every(
    (agent) => savedNames.has(agent.name) || skippedNames.has(agent.name),
  );
}

export function UnknownAgentsAfterScrapeModal({
  open,
  agents,
  onComplete,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, AgentDraft>>({});
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [skippedNames, setSkippedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDrafts(Object.fromEntries(agents.map((agent) => [agent.name, toDraft(agent)])));
    setSavedNames(new Set());
    setSkippedNames(new Set());
    setSavingName(null);
  }, [open, agents]);

  function updateDraft(name: string, patch: Partial<AgentDraft>) {
    setDrafts((current) => ({
      ...current,
      [name]: { ...current[name], ...patch },
    }));
  }

  function maybeComplete(
    nextSaved: Set<string>,
    nextSkipped: Set<string>,
  ) {
    if (allAgentsHandled(agents, nextSaved, nextSkipped)) {
      onComplete();
    }
  }

  async function saveAgent(name: string) {
    const draft = drafts[name];
    if (!draft?.name.trim()) {
      toast.error("Agent name is required");
      return;
    }

    setSavingName(name);
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        role_title: draft.role_title.trim() || undefined,
        photo_url: draft.photo_url.trim() || undefined,
        is_default: draft.is_default,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to add agent");
      setSavingName(null);
      return;
    }

    toast.success(`${draft.name} added to your agency`);
    const nextSaved = new Set(savedNames).add(name);
    setSavedNames(nextSaved);
    setSavingName(null);
    maybeComplete(nextSaved, skippedNames);
  }

  function skipAgent(name: string) {
    const nextSkipped = new Set(skippedNames).add(name);
    setSkippedNames(nextSkipped);
    maybeComplete(savedNames, nextSkipped);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onComplete();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New agents on this listing</DialogTitle>
          <DialogDescription>
            We found listing agents that aren&apos;t in your account yet. Add them
            now to use their details and photos on reports, or continue without
            adding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {agents.map((agent) => {
            const draft = drafts[agent.name] ?? toDraft(agent);
            const isSaved = savedNames.has(agent.name);
            const isSkipped = skippedNames.has(agent.name);

            return (
              <div
                key={agent.name}
                className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4"
              >
                <div className="flex items-start gap-4">
                  {draft.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.photo_url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {draft.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`agent-name-${agent.name}`}>Name</Label>
                      <Input
                        id={`agent-name-${agent.name}`}
                        value={draft.name}
                        disabled={isSaved || isSkipped}
                        onChange={(event) =>
                          updateDraft(agent.name, { name: event.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`agent-role-${agent.name}`}>Role title</Label>
                        <Input
                          id={`agent-role-${agent.name}`}
                          value={draft.role_title}
                          disabled={isSaved || isSkipped}
                          onChange={(event) =>
                            updateDraft(agent.name, { role_title: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`agent-phone-${agent.name}`}>Phone</Label>
                        <Input
                          id={`agent-phone-${agent.name}`}
                          value={draft.phone}
                          disabled={isSaved || isSkipped}
                          onChange={(event) =>
                            updateDraft(agent.name, { phone: event.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`agent-email-${agent.name}`}>Email</Label>
                      <Input
                        id={`agent-email-${agent.name}`}
                        type="email"
                        value={draft.email}
                        disabled={isSaved || isSkipped}
                        onChange={(event) =>
                          updateDraft(agent.name, { email: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`agent-photo-${agent.name}`}>Photo URL</Label>
                      <Input
                        id={`agent-photo-${agent.name}`}
                        value={draft.photo_url}
                        disabled={isSaved || isSkipped}
                        onChange={(event) =>
                          updateDraft(agent.name, { photo_url: event.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {isSaved ? (
                  <p className="text-sm font-medium text-emerald-700">Added to your agency</p>
                ) : isSkipped ? (
                  <p className="text-sm text-muted-foreground">Skipped</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={savingName === agent.name}
                      onClick={() => saveAgent(agent.name)}
                    >
                      {savingName === agent.name ? "Adding..." : "Add agent"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(savingName)}
                      onClick={() => skipAgent(agent.name)}
                    >
                      Skip
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter showCloseButton={false}>
          <Button variant="outline" onClick={onComplete}>
            Continue to listing review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
