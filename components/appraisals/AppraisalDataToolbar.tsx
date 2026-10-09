"use client";

import { ArrowRight, Loader2 } from "lucide-react";

type Props = {
  summary: string | null;
  selectedCount: number;
  maxSelected: number;
  saving: boolean;
  disabled: boolean;
  guidance: string;
  onContinue: () => void;
  continueLabel?: string;
};

export function AppraisalDataToolbar({
  summary,
  selectedCount,
  maxSelected,
  saving,
  disabled,
  guidance,
  onContinue,
  continueLabel = "Continue to edit content",
}: Props) {
  return (
    <div
      data-theme="staypack-workspace"
      className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-100 p-4 text-base-content shadow-sm"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">
            {summary ?? "Review appraisal data"}
          </p>
          <span className="du-badge du-badge-sm">
            {selectedCount} / {maxSelected} selected
          </span>
        </div>
        <p role="status" className="text-xs">
          {guidance}
        </p>
      </div>
      <button
        type="button"
        className="du-btn du-btn-sm du-btn-primary min-h-11 w-full sm:w-auto"
        disabled={disabled}
        onClick={onContinue}
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {saving ? "Saving…" : continueLabel}
        {!saving ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}
