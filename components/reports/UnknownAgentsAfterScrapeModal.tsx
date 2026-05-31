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

type CompletionPayload = {
  saved: Array<{
    originalName: string;
    agent: UnknownAgent;
  }>;
  skippedNames: string[];
};

type Props = {
  open: boolean;
  agents: UnknownAgent[];
  onComplete: (payload: CompletionPayload) => void;
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
  const [attemptedNames, setAttemptedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDrafts(Object.fromEntries(agents.map((agent) => [agent.name, toDraft(agent)])));
    setSavedNames(new Set());
    setSkippedNames(new Set());
    setAttemptedNames(new Set());
    setSavingName(null);
  }, [open, agents]);

  function updateDraft(name: string, patch: Partial<AgentDraft>) {
    setDrafts((current) => ({
      ...current,
      [name]: { ...current[name], ...patch },
    }));
  }

  function buildCompletionPayload(
    nextSaved: Set<string>,
    nextSkipped: Set<string>,
  ): CompletionPayload {
    const saved = [...nextSaved]
      .map((originalName) => {
        const draft = drafts[originalName];
        if (!draft) return null;
        return {
          originalName,
          agent: {
            name: draft.name.trim(),
            email: draft.email.trim(),
            phone: draft.phone.trim(),
            role_title: draft.role_title.trim(),
            photo_url: draft.photo_url.trim(),
          } as UnknownAgent,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      saved,
      skippedNames: [...nextSkipped],
    };
  }

  function maybeComplete(
    nextSaved: Set<string>,
    nextSkipped: Set<string>,
  ) {
    if (allAgentsHandled(agents, nextSaved, nextSkipped)) {
      onComplete(buildCompletionPayload(nextSaved, nextSkipped));
    }
  }

  function missingRequiredFields(draft: AgentDraft) {
    const missing: string[] = [];
    if (!draft.name.trim()) missing.push("name");
    if (!draft.phone.trim()) missing.push("phone");
    return missing;
  }

  async function saveAgent(name: string) {
    const draft = drafts[name];
    if (!draft) return;

    setAttemptedNames((current) => new Set(current).add(name));
    const missing = missingRequiredFields(draft);
    if (missing.length > 0) {
      toast.error(`Please complete all required fields: ${missing.join(", ")}`);
      return;
    }

    setSavingName(name);
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        role_title: draft.role_title.trim(),
        photo_url: draft.photo_url.trim(),
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

  const allHandled = allAgentsHandled(agents, savedNames, skippedNames);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onComplete(buildCompletionPayload(savedNames, skippedNames));
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
          <p className="text-xs font-medium text-muted-foreground">
            Name and phone are required to add an agent.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {agents.map((agent) => {
            const draft = drafts[agent.name] ?? toDraft(agent);
            const isSaved = savedNames.has(agent.name);
            const isSkipped = skippedNames.has(agent.name);
            const attempted = attemptedNames.has(agent.name);
            const missing = missingRequiredFields(draft);
            const showMissing = attempted && !isSaved && !isSkipped;

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
                      <Label htmlFor={`agent-name-${agent.name}`}>Name *</Label>
                      <Input
                        id={`agent-name-${agent.name}`}
                        value={draft.name}
                        aria-invalid={showMissing && !draft.name.trim()}
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
                        <Label htmlFor={`agent-phone-${agent.name}`}>Phone *</Label>
                        <Input
                          id={`agent-phone-${agent.name}`}
                          value={draft.phone}
                          aria-invalid={showMissing && !draft.phone.trim()}
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
                    {showMissing && missing.length > 0 ? (
                      <p className="text-xs text-destructive">
                        Complete required fields: {missing.join(", ")}.
                      </p>
                    ) : null}
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
          <Button
            variant="outline"
            disabled={!allHandled}
            onClick={() => onComplete(buildCompletionPayload(savedNames, skippedNames))}
          >
            Continue to listing review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
