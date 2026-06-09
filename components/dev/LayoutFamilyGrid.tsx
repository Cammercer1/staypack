"use client";

import {
  PLAYGROUND_LAYOUT_FAMILIES,
  type PlaygroundLayoutFamilyId,
} from "@/lib/reports/templates/playgroundResolve";
import { cn } from "@/lib/utils";

export type LayoutFamilyId = PlaygroundLayoutFamilyId | "haven-properties";

type Props = {
  value: LayoutFamilyId;
  onChange: (family: LayoutFamilyId) => void;
  /** e.g. Haven lease — shown as an extra chip when provided */
  extraFamilies?: { id: string; label: string }[];
};

export function LayoutFamilyGrid({ value, onChange, extraFamilies }: Props) {
  const all = [
    ...PLAYGROUND_LAYOUT_FAMILIES,
    ...(extraFamilies ?? []).filter(
      (e) => !PLAYGROUND_LAYOUT_FAMILIES.some((f) => f.id === e.id),
    ),
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {all.map((family) => {
        const selected = value === family.id;
        return (
          <button
            key={family.id}
            type="button"
            onClick={() => onChange(family.id as LayoutFamilyId)}
            className={cn(
              "rounded-md border px-1 py-2 text-center text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/80 bg-background text-foreground hover:border-primary/50 hover:bg-muted/50",
            )}
          >
            {family.label}
          </button>
        );
      })}
    </div>
  );
}
