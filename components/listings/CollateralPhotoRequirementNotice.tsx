"use client";

import { Button } from "@/components/ui/button";
import type { CollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";

type Props = {
  requirement: CollateralPhotoRequirement;
  onGoToPhotos?: () => void;
};

export function CollateralPhotoRequirementNotice({
  requirement,
  onGoToPhotos,
}: Props) {
  if (requirement.met) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <p className="text-sm text-foreground">{requirement.message}</p>
      {onGoToPhotos ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onGoToPhotos}
        >
          Add photos
        </Button>
      ) : null}
    </div>
  );
}
