"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { AgentPhotoUploader } from "./AgentPhotoUploader";
import {
  agentProfileSchema,
  type AgentProfileInput,
} from "@/lib/validation/schemas";
import {
  duplicateReasons,
  findDuplicateAgents,
  findBlockingDuplicateAgents,
} from "@/lib/agents/directory";
import type { AgentProfile } from "@/lib/types";

export function AgentProfileForm({
  initial,
  agents = [],
  onSaved,
  onCancel,
  onEditDuplicate,
  onStateChange,
  canEdit = true,
}: {
  initial?: AgentProfile;
  agents?: AgentProfile[];
  onSaved: (agent: AgentProfile) => void;
  onCancel?: () => void;
  onEditDuplicate?: (agent: AgentProfile) => void;
  onStateChange?: (dirty: boolean, busy: boolean) => void;
  canEdit?: boolean;
}) {
  const form = useForm<AgentProfileInput>({
    resolver: zodResolver(agentProfileSchema),
    defaultValues: {
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      role_title: initial?.role_title ?? "",
      photo_url: initial?.photo_url ?? "",
      is_default: initial?.is_default ?? false,
    },
  });
  const values = useWatch({ control: form.control });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverMatch, setServerMatch] = useState<AgentProfile | null>(null);
  const dirty = form.formState.isDirty;
  const saving = form.formState.isSubmitting;
  const matchCandidates = serverMatch
    ? [...agents.filter((agent) => agent.id !== serverMatch.id), serverMatch]
    : agents;
  const duplicates = findDuplicateAgents(values, matchCandidates, initial?.id);
  const blocked =
    findBlockingDuplicateAgents(values, matchCandidates, initial).length > 0;
  const defaultAgent = agents.find(
    (agent) =>
      agent.is_default && agent.id !== initial?.id && !agent.archived_at,
  );
  useEffect(() => {
    onStateChange?.(dirty || photoBusy, saving || photoBusy);
  }, [dirty, saving, photoBusy, onStateChange]);

  async function save(input: AgentProfileInput) {
    if (!canEdit || photoBusy) return;
    setError(null);
    if (blocked) {
      setError(
        "An agent already uses this email or phone. Edit or restore the existing profile.",
      );
      return;
    }
    try {
      const response = await fetch("/api/agents", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          ...(initial
            ? { id: initial.id, updated_at: initial.updated_at }
            : {}),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (payload?.duplicateAgent) setServerMatch(payload.duplicateAgent);
      if (!response.ok || !payload?.agent)
        throw new Error(
          payload?.error || "Could not save this agent. Please try again.",
        );
      form.reset(input);
      onSaved(payload.agent);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not save this agent. Please try again.",
      );
    }
  }
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(save)}
      className="flex min-h-0 flex-1 flex-col"
      aria-label={initial ? "Edit agent profile" : "Add agent profile"}
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
        <AgentPhotoUploader
          fieldId="agent-photo"
          value={values.photo_url ?? ""}
          fallbackInitial={values.name}
          readOnly={!canEdit || saving}
          onBusyChange={setPhotoBusy}
          onChange={(url) =>
            form.setValue("photo_url", url, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <fieldset disabled={!canEdit || saving} className="grid min-w-0 gap-5">
          <legend className="sr-only">Contact details</legend>
          {(
            [
              {
                key: "name",
                label: "Name",
                type: "text",
                autocomplete: "name",
              },
              {
                key: "role_title",
                label: "Role title",
                type: "text",
                autocomplete: "organization-title",
              },
              {
                key: "email",
                label: "Email",
                type: "email",
                autocomplete: "email",
              },
              {
                key: "phone",
                label: "Phone",
                type: "tel",
                autocomplete: "tel",
              },
            ] as const
          ).map((field) => (
            <div key={field.key} className="space-y-2">
              <label
                htmlFor={`agent-${field.key}`}
                className="block text-sm font-medium"
              >
                {field.label}{" "}
                <span className="font-normal text-muted-foreground">
                  {field.key === "name" ? "(required)" : "(optional)"}
                </span>
              </label>
              <input
                id={`agent-${field.key}`}
                aria-label={`${field.label} (${field.key === "name" ? "required" : "optional"})`}
                type={field.type}
                autoComplete={field.autocomplete}
                aria-required={field.key === "name"}
                aria-invalid={!!form.formState.errors[field.key]}
                aria-describedby={
                  form.formState.errors[field.key]
                    ? `agent-${field.key}-error`
                    : undefined
                }
                {...form.register(field.key)}
                className="du-input w-full bg-base-100"
              />
              {form.formState.errors[field.key] && (
                <p
                  id={`agent-${field.key}-error`}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {form.formState.errors[field.key]?.message}
                </p>
              )}
            </div>
          ))}
          <div className="rounded-xl border border-base-300 p-4">
            <label className="flex items-start gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                {...form.register("is_default")}
                aria-describedby="agent-default-help"
              />
              Use as agency default
            </label>
            <p
              id="agent-default-help"
              className="mt-2 text-xs leading-relaxed text-muted-foreground"
            >
              Used as the fallback contact when a report needs an agency agent
              and no agent is assigned. Listing-specific agents take priority.
            </p>
            {values.is_default && defaultAgent && (
              <p className="mt-2 text-xs">
                Saving will replace {defaultAgent.name} as the default.
              </p>
            )}
          </div>
        </fieldset>
        {!!duplicates.length && (
          <section
            className="rounded-xl border border-base-300 bg-muted/40 p-4"
            aria-label="Possible duplicate agents"
          >
            <h3 className="font-medium">
              {blocked ? "Agent already exists" : "Possible matches"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {blocked
                ? "This email or phone belongs to an existing agent. Edit that profile, or restore it if archived. Duplicate profiles cannot be saved."
                : "These profiles have similar details. Names alone do not identify a person; matching email addresses or complete phone numbers block new duplicates."}
            </p>
            <ul className="mt-3 space-y-3">
              {duplicates.map((agent) => (
                <li key={agent.id} className="space-y-1 text-sm">
                  <p className="font-medium">
                    {agent.name}
                    {agent.archived_at ? " · Archived" : ""}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    {[agent.email, agent.phone].filter(Boolean).join(" · ") ||
                      agent.role_title}{" "}
                    · Matching {duplicateReasons(values, agent).join(", ")}
                  </p>
                  {onEditDuplicate && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || photoBusy}
                      onClick={() => onEditDuplicate(agent)}
                    >
                      {agent.archived_at
                        ? "View archived agent"
                        : "Edit existing agent"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {error && (
          <div role="alert" className="du-alert du-alert-error text-sm">
            {error} Your changes are still here.
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-base-300 bg-background px-5 py-4 sm:px-8">
        <p role="status" className="mb-3 text-xs text-muted-foreground">
          {saving
            ? "Saving agent…"
            : photoBusy
              ? "Finish or cancel the photo change before saving."
              : blocked
                ? "This email or phone already belongs to an agent."
                : dirty
                  ? "Unsaved changes"
                  : initial
                    ? "All changes saved"
                    : "Add a name to get started."}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={saving || photoBusy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          {dirty && (
            <Button
              type="button"
              variant="outline"
              disabled={saving || photoBusy}
              onClick={() => {
                form.reset();
                setError(null);
                setServerMatch(null);
              }}
            >
              Discard
            </Button>
          )}
          <Button
            type="submit"
            disabled={!canEdit || !dirty || saving || photoBusy || blocked}
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Add agent"}
          </Button>
        </div>
      </div>
    </form>
  );
}
