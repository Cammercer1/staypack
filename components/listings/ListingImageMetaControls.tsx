"use client";

import { cn } from "@/lib/utils";
import {
  getListingImageMeta,
  resolveListingImageRole,
  setListingImageMetaEntry,
} from "@/lib/listings/listingImageMeta";
import type { ListingImageMetaMap } from "@/lib/types";

type Props = {
  url: string;
  meta: ListingImageMetaMap;
  onChange: (meta: ListingImageMetaMap) => void;
  className?: string;
};

export function ListingImageMetaControls({ url, meta, onChange, className }: Props) {
  const role = resolveListingImageRole(meta, url);
  const label = getListingImageMeta(meta, url)?.label ?? "";

  function setRole(nextRole: "photo" | "floor_plan") {
    onChange(
      setListingImageMetaEntry(meta, url, {
        role: nextRole,
        label: label || undefined,
      }),
    );
  }

  function setLabel(nextLabel: string) {
    onChange(
      setListingImageMetaEntry(meta, url, {
        role,
        label: nextLabel,
      }),
    );
  }

  return (
    <div
      className={cn("space-y-2 rounded-md border border-border/60 bg-muted/30 p-2", className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex gap-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
            role === "photo"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
          onClick={() => setRole("photo")}
        >
          Photo
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
            role === "floor_plan"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
          onClick={() => setRole("floor_plan")}
        >
          Floor plan
        </button>
      </div>
      {role === "floor_plan" ? (
        <input
          type="text"
          value={label}
          placeholder="Label (e.g. Ground floor)"
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
          onChange={(event) => setLabel(event.target.value)}
        />
      ) : null}
    </div>
  );
}

export function ListingImageMetaBadge({
  url,
  meta,
}: {
  url: string;
  meta: ListingImageMetaMap;
}) {
  if (resolveListingImageRole(meta, url) !== "floor_plan") {
    return null;
  }

  const label = getListingImageMeta(meta, url)?.label?.trim();

  return (
    <span className="absolute bottom-2 left-2 rounded bg-neutral-900/85 px-2 py-0.5 text-[10px] font-medium text-white">
      {label || "Floor plan"}
    </span>
  );
}
