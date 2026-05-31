"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resolveBrochureImagePresentation } from "@/lib/collateral/sales-brochure/brochureImageFit";
import { getListingImagePool } from "@/lib/listings/collateralImages";
import { resolveListingImageRole } from "@/lib/listings/listingImageMeta";
import type { Listing } from "@/lib/types";
import type { BrochureImageSlot } from "@/components/collateral/sales-brochure/inline/EditableContext";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing;
  slot: BrochureImageSlot | null;
  currentUrl?: string;
  onSelect: (url: string) => void;
};

function slotLabel(slot: BrochureImageSlot | null) {
  if (!slot) return "photo";
  if (slot === "hero") return "hero photo";
  if (typeof slot === "object") {
    if (slot.kind === "page_one") return `page 1 photo ${slot.index + 1}`;
    if (slot.kind === "page_two") return `page 2 photo ${slot.index + 1}`;
    if (slot.kind === "gallery") return `gallery photo ${slot.index + 1}`;
  }
  return "photo";
}

export function BrochureImagePickerDialog({
  open,
  onOpenChange,
  listing,
  slot,
  currentUrl,
  onSelect,
}: Props) {
  const pool = useMemo(() => getListingImagePool(listing), [listing]);
  const meta = listing.listing_image_meta ?? {};
  const [picked, setPicked] = useState(currentUrl ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose {slotLabel(slot)}</DialogTitle>
          <DialogDescription>
            Pick a photo from this listing. Changes apply to this brochure only.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {pool.map((url) => {
            const presentation = resolveBrochureImagePresentation(url, null, meta);
            const isFloorPlan = resolveListingImageRole(meta, url) === "floor_plan";

            return (
              <button
                key={url}
                type="button"
                className={cn(
                  "relative aspect-[4/3] overflow-hidden rounded-md border-2 transition",
                  presentation.frameClassName,
                  picked === url
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent hover:border-primary/40",
                )}
                onClick={() => {
                  setPicked(url);
                  onSelect(url);
                  onOpenChange(false);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className={cn("h-full w-full", presentation.imgClassName)}
                />
                {isFloorPlan ? (
                  <span className="absolute bottom-1 left-1 rounded bg-neutral-900/85 px-1.5 py-0.5 text-[9px] font-medium text-white">
                    Floor plan
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {pool.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No photos on this listing yet. Add photos in the listing workspace first.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
