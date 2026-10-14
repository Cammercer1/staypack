"use client";

import { Check, ChevronDown } from "lucide-react";
import { SOCIAL_POST_BACKGROUND_LAYOUTS } from "@/lib/collateral/social/backgroundLayout";
import type { SocialPostBackgroundLayout } from "@/lib/collateral/templates/types";
import { cn } from "@/lib/utils";

type Props = {
  value: SocialPostBackgroundLayout;
  onChange: (layout: SocialPostBackgroundLayout) => void;
};

const gridClasses: Record<SocialPostBackgroundLayout, string> = {
  single: "grid-cols-1 grid-rows-1",
  split_vertical: "grid-cols-1 grid-rows-2",
  split_horizontal: "grid-cols-2 grid-rows-1",
  grid_2x2: "grid-cols-2 grid-rows-2",
  row_3: "grid-cols-3 grid-rows-1",
  col_3: "grid-cols-1 grid-rows-3",
};

export function SocialPostBackgroundLayoutPicker({ value, onChange }: Props) {
  function choice(spec: (typeof SOCIAL_POST_BACKGROUND_LAYOUTS)[number]) {
    const selected = value === spec.id;
    return (
      <button
        key={spec.id}
        type="button"
        title={spec.description}
        aria-pressed={selected}
        onClick={() => onChange(spec.id)}
        className={cn(
          "relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary",
          selected
            ? "border-primary bg-primary/5 text-primary"
            : "border-base-300 text-base-content/65 hover:bg-base-200",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid h-8 w-10 gap-0.5 overflow-hidden rounded border border-current p-0.5",
            gridClasses[spec.id],
          )}
        >
          {Array.from({ length: spec.cellCount }).map((_, index) => (
            <span key={index} className="rounded-sm bg-current opacity-40" />
          ))}
        </span>
        <span className="text-xs font-medium">
          {spec.id === "single" ? "Single photo" : spec.label}
        </span>
        {selected ? (
          <Check
            className="absolute right-1.5 top-1.5 size-3"
            aria-hidden="true"
          />
        ) : null}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Photo layout</p>
      <div
        role="group"
        aria-label="Photo layout"
        className="grid grid-cols-3 gap-2"
      >
        {SOCIAL_POST_BACKGROUND_LAYOUTS.slice(0, 3).map(choice)}
      </div>
      <details
        key={
          value === "single" || value.startsWith("split") ? "simple" : "collage"
        }
        open={
          value !== "single" && !value.startsWith("split") ? true : undefined
        }
        className="group/layout"
      >
        <summary className="flex min-h-11 cursor-pointer [list-style:none] items-center justify-between rounded text-xs font-medium text-base-content/65 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          More photo layouts
          <ChevronDown
            className="size-4 group-open/layout:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div
          role="group"
          aria-label="More photo layouts"
          className="grid grid-cols-3 gap-2 pb-2"
        >
          {SOCIAL_POST_BACKGROUND_LAYOUTS.slice(3).map(choice)}
        </div>
      </details>
    </div>
  );
}
