"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  id: string;
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function LayerChoiceControl<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div id={id} role="group" aria-label={label} className="flex gap-1">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "outline"}
            className="min-h-11 flex-1 text-xs"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
