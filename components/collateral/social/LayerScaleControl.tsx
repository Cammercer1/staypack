"use client";

import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Override display (default: value × 100). */
  formatDisplay?: (value: number) => number;
};

export function LayerScaleControl({
  id,
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  formatDisplay,
}: Props) {
  const percent = Math.round(formatDisplay ? formatDisplay(value) : value * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <span className="text-xs tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}
