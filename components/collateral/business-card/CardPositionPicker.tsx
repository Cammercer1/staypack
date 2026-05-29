"use client";

import { cn } from "@/lib/utils";

export type CardPosition =
  | "TL" | "TC" | "TR"
  | "ML" | "MC" | "MR"
  | "BL" | "BC" | "BR";

/** X/Y snap coordinates (% of card width/height) for each position. */
export const CARD_POSITION_COORDS: Record<CardPosition, { x: number; y: number }> = {
  TL: { x: 5, y: 8 },  TC: { x: 30, y: 8 },  TR: { x: 68, y: 8 },
  ML: { x: 5, y: 44 }, MC: { x: 30, y: 44 }, MR: { x: 68, y: 44 },
  BL: { x: 5, y: 78 }, BC: { x: 30, y: 78 }, BR: { x: 68, y: 78 },
};

const GRID: CardPosition[][] = [
  ["TL", "TC", "TR"],
  ["ML", "MC", "MR"],
  ["BL", "BC", "BR"],
];

/** Snap threshold — within this many % points, treat as "at" the position. */
const SNAP_THRESHOLD = 12;

export function closestCardPosition(x: number, y: number): CardPosition {
  let best: CardPosition = "TL";
  let bestDist = Infinity;
  for (const [id, coords] of Object.entries(CARD_POSITION_COORDS) as [CardPosition, { x: number; y: number }][]) {
    const dist = Math.abs(x - coords.x) + Math.abs(y - coords.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = id;
    }
  }
  return best;
}

export function isAtCardPosition(x: number, y: number, pos: CardPosition): boolean {
  const coords = CARD_POSITION_COORDS[pos];
  return Math.abs(x - coords.x) + Math.abs(y - coords.y) <= SNAP_THRESHOLD;
}

type Props = {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  label?: string;
  /** Highlight positions to dim (e.g. reserved by another element). */
  reserved?: { x: number; y: number };
};

export function CardPositionPicker({ x, y, onChange, label, reserved }: Props) {
  const active = closestCardPosition(x, y);
  const reservedPos = reserved ? closestCardPosition(reserved.x, reserved.y) : null;

  return (
    <div className="space-y-1.5">
      {label ? (
        <p className="text-xs text-muted-foreground">{label}</p>
      ) : null}
      {/* Mini card shape: 3×3 grid */}
      <div
        className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-muted/20 p-2"
        style={{ aspectRatio: "90 / 55" }}
        role="group"
        aria-label={label ?? "Position"}
      >
        {GRID.flat().map((pos) => {
          const isActive = active === pos;
          const isReserved = reservedPos === pos && pos !== active;
          return (
            <button
              key={pos}
              type="button"
              title={pos.replace("T", "Top ").replace("M", "Middle ").replace("B", "Bottom ").replace("L", "left").replace("C", "centre").replace("R", "right")}
              onClick={() => {
                const { x: nx, y: ny } = CARD_POSITION_COORDS[pos];
                onChange(nx, ny);
              }}
              className={cn(
                "rounded-[3px] transition-colors",
                isActive
                  ? "bg-primary shadow-sm"
                  : isReserved
                    ? "bg-muted-foreground/20"
                    : "bg-transparent hover:bg-primary/20",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
