"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CopyEditorContextMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export function CopyEditorField({
  label,
  value,
  onChange,
  textarea = false,
  hint,
  limit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  hint?: string;
  limit?: {
    max: number;
    hint: string;
  } | null;
}) {
  const atLimit = limit ? value.length >= limit.max : false;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {limit ? (
          <span
            className={
              atLimit
                ? "text-xs font-medium text-amber-700"
                : "text-xs text-muted-foreground"
            }
          >
            {value.length}/{limit.max}
          </span>
        ) : null}
      </div>
      {textarea ? (
        <Textarea
          rows={4}
          value={value}
          maxLength={limit?.max}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          value={value}
          maxLength={limit?.max}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {limit ? (
        <p className="text-xs text-muted-foreground">{limit.hint}</p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CopyEditorUnsavedBar({
  saving,
  generating,
  saveLabel,
  description = "Save before continuing to preview.",
  onSave,
}: {
  saving: boolean;
  generating: boolean;
  saveLabel: string;
  description?: string;
  onSave: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-200/90 bg-amber-50/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-amber-800/60 dark:bg-amber-950/95"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Unsaved changes</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button
          size="lg"
          className="shrink-0 shadow-md"
          disabled={saving || generating}
          onClick={onSave}
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </div>
    </div>
  );
}
