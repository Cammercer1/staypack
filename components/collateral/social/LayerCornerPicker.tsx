"use client";

import { cn } from "@/lib/utils";
import type {
  SocialPostCorner,
  SocialPostCopyPlacement,
} from "@/lib/collateral/templates/types";
import type { SocialPostTopCorner } from "@/lib/collateral/social/presetPlacement";

type CornerProps = {
  value: SocialPostCorner;
  onChange: (value: SocialPostCorner) => void;
  label?: string;
};

const CORNERS: { id: SocialPostCorner; label: string }[] = [
  { id: "top_left", label: "TL" },
  { id: "top_right", label: "TR" },
  { id: "bottom_left", label: "BL" },
  { id: "bottom_right", label: "BR" },
];

export function LayerCornerPicker({ value, onChange, label }: CornerProps) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <p className="text-xs text-muted-foreground">{label}</p>
      ) : null}
      <div
        className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1.5"
        role="group"
        aria-label={label ?? "Position"}
      >
        {CORNERS.map((corner) => (
          <button
            key={corner.id}
            type="button"
            title={corner.id.replace("_", " ")}
            onClick={() => onChange(corner.id)}
            className={cn(
              "rounded-md px-2 py-2 text-xs font-medium transition-colors",
              value === corner.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {corner.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const TOP_CORNERS: { id: SocialPostTopCorner; label: string }[] = [
  { id: "top_left", label: "TL" },
  { id: "top_right", label: "TR" },
];

/** Top-left / top-right only (logo). */
export function LayerTopCornerPicker({
  value,
  onChange,
  label = "Position",
}: {
  value: SocialPostTopCorner;
  onChange: (value: SocialPostTopCorner) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className="inline-flex w-full rounded-lg border border-border/60 bg-muted/30 p-0.5"
        role="group"
      >
        {TOP_CORNERS.map((corner) => (
          <button
            key={corner.id}
            type="button"
            onClick={() => onChange(corner.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors",
              value === corner.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {corner.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type BottomCornerProps = {
  value: SocialPostCopyPlacement;
  onChange: (value: SocialPostCopyPlacement) => void;
  label?: string;
};

/** Bottom-left / bottom-right only (e.g. agent). */
export function LayerBottomCornerPicker({
  value,
  onChange,
  label = "Position",
}: BottomCornerProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className="inline-flex w-full rounded-lg border border-border/60 bg-muted/30 p-0.5"
        role="group"
      >
        {(
          [
            { id: "bottom_left" as const, label: "Left" },
            { id: "bottom_center" as const, label: "Center" },
            { id: "bottom_right" as const, label: "Right" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              value === option.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
