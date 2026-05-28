"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SocialPostTextAlign } from "@/lib/collateral/templates/types";

const OPTIONS: {
  value: SocialPostTextAlign;
  label: string;
  icon: typeof AlignLeft;
}[] = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
];

type Props = {
  id: string;
  label: string;
  value: SocialPostTextAlign;
  onChange: (value: SocialPostTextAlign) => void;
};

export function LayerTextAlignControl({ id, label, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div
        id={id}
        role="group"
        aria-label={label}
        className="flex gap-1"
      >
        {OPTIONS.map(({ value: option, label: optionLabel, icon: Icon }) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={value === option ? "default" : "outline"}
            className="flex-1"
            onClick={() => onChange(option)}
            title={optionLabel}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">{optionLabel}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
