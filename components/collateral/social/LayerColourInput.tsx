"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeHexColour } from "@/lib/collateral/social/agentStyle";

type Props = {
  id: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
};

export function LayerColourInput({
  id,
  label,
  value,
  fallback,
  onChange,
}: Props) {
  const resolved = normalizeHexColour(value, fallback);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={resolved}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}
