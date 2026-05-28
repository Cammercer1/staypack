"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollateralPdfButton } from "@/components/collateral/CollateralPdfButton";
import { COLLATERAL_TYPE_META } from "@/lib/listings/collateralTypes";
import type { CollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";
import type { CollateralItem, CollateralType } from "@/lib/types";

type Props = {
  listingId: string;
  type: CollateralType;
  item: CollateralItem | null;
  photoRequirement: CollateralPhotoRequirement;
  onRefresh: () => void;
};

export function CollateralItemActions({
  listingId,
  type,
  item,
  photoRequirement,
  onRefresh,
}: Props) {
  const [localItem, setLocalItem] = useState(item);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  const activeItem = localItem ?? item;
  const meta = COLLATERAL_TYPE_META[type];
  const hasDocument = Boolean(activeItem?.document_json);
  const canGeneratePdf = hasDocument && type !== "social_posts";
  const canCreateOrGenerate = photoRequirement.met;

  async function createDraft() {
    if (!canCreateOrGenerate) return;

    setCreating(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/collateral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create collateral");
      }
      setLocalItem(payload.collateral as CollateralItem);
      toast.success(`${meta.label} draft created`);
      onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create collateral",
      );
    } finally {
      setCreating(false);
    }
  }

  async function generateCollateral() {
    if (!activeItem || !canCreateOrGenerate) return;

    setGenerating(true);
    try {
      const response = await fetch(`/api/collateral/${activeItem.id}/generate`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate collateral");
      }
      setLocalItem(payload.collateral as CollateralItem);
      toast.success(`${meta.label} generated`);
      onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to generate collateral",
      );
    } finally {
      setGenerating(false);
    }
  }

  if (!canCreateOrGenerate && !hasDocument) {
    return null;
  }

  if (!activeItem) {
    return (
      <Button onClick={createDraft} disabled={creating} size="sm">
        {creating ? (
          <>
            <Loader2 className="animate-spin" />
            Creating...
          </>
        ) : (
          "Create"
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!hasDocument ? (
          <Button
            onClick={generateCollateral}
            disabled={generating || !canCreateOrGenerate}
            size="sm"
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={generateCollateral}
              disabled={generating || !canCreateOrGenerate}
              size="sm"
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate"
              )}
            </Button>
            <CollateralPdfButton
              collateralId={activeItem.id}
              url={activeItem.pdf_url}
              canGenerate={canGeneratePdf}
              cacheVersion={activeItem.updated_at}
              onUpdated={(next) => {
                setLocalItem(next);
                onRefresh();
              }}
            />
          </>
        )}
      </div>

      {!canCreateOrGenerate && hasDocument ? (
        <p className="text-xs text-muted-foreground">
          {photoRequirement.message}
        </p>
      ) : null}
    </div>
  );
}
