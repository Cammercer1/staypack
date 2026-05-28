"use client";

import { SOCIAL_POST_BACKGROUND_LAYOUTS } from "@/lib/collateral/social/backgroundLayout";
import type { SocialPostBackgroundLayout } from "@/lib/collateral/templates/types";
import { Label } from "@/components/ui/label";

type Props = {
  value: SocialPostBackgroundLayout;
  onChange: (layout: SocialPostBackgroundLayout) => void;
};

function LayoutPreview({ layout }: { layout: SocialPostBackgroundLayout }) {
  const spec = SOCIAL_POST_BACKGROUND_LAYOUTS.find((item) => item.id === layout);
  if (!spec) return null;

  return (
    <div
      className="grid h-9 w-9 gap-px overflow-hidden rounded-sm bg-black/80 p-px"
      style={spec.gridStyle}
    >
      {Array.from({ length: spec.cellCount }).map((_, index) => (
        <div
          key={index}
          className="rounded-[1px] bg-white/90"
        />
      ))}
    </div>
  );
}

export function SocialPostBackgroundLayoutPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Layout</Label>
      <div className="grid grid-cols-3 gap-1.5">
        {SOCIAL_POST_BACKGROUND_LAYOUTS.map((spec) => {
          const selected = value === spec.id;
          return (
            <button
              key={spec.id}
              type="button"
              title={spec.description}
              onClick={() => onChange(spec.id)}
              className={`flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-center transition ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border/70 hover:border-border hover:bg-muted/40"
              }`}
            >
              <LayoutPreview layout={spec.id} />
              <span className="text-[10px] font-medium leading-tight text-foreground">
                {spec.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
