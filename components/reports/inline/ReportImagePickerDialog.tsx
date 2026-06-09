"use client";

import { useMemo } from "react";
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
import { reportImageSlotLabel } from "@/lib/reports/editable/reportImageSlots";
import type { ReportImageSlot } from "@/lib/reports/editable/reportImageSlots";
import type { Listing } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing;
  slot: ReportImageSlot | null;
  currentUrl?: string;
  onSelect: (url: string) => void;
};

export function ReportImagePickerDialog({
  open,
  onOpenChange,
  listing,
  slot,
  currentUrl,
  onSelect,
}: Props) {
  const pool = useMemo(() => getListingImagePool(listing), [listing]);
  const meta = listing.listing_image_meta ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose {reportImageSlotLabel(slot)}</DialogTitle>
          <DialogDescription>
            Pick a photo or floor plan from this listing. Changes apply to this
            appraisal only.
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
                  currentUrl === url
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent hover:border-primary/40",
                )}
                onClick={() => {
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
