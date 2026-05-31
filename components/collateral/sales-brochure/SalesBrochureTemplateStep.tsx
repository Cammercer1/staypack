"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { SalesBrochureTemplatePicker } from "@/components/collateral/sales-brochure/SalesBrochureTemplatePicker";
import { buildBrochureTemplatePreview } from "@/lib/collateral/sales-brochure/templatePreviewDocument";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import type { Agency, CollateralItem, CollateralType, Listing } from "@/lib/types";

type BrochureCollateralType = Extract<
  CollateralType,
  "sales_brochure" | "rental_brochure"
>;

type Props = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  collateralType?: BrochureCollateralType;
  onCollateralChange: (collateral: CollateralItem) => void;
  onContinue: () => void;
};

type ApiError = {
  error?: string;
};

export function SalesBrochureTemplateStep({
  agency,
  listing,
  collateral,
  collateralType = "sales_brochure",
  onCollateralChange,
  onContinue,
}: Props) {
  const defaultTemplateId = resolveCollateralTemplateId(agency, collateral);
  const [selectedTemplateId, setSelectedTemplateId] = useState(() =>
    resolveCollateralTemplateId(agency, collateral),
  );
  const [saving, setSaving] = useState(false);

  const previewDocument = useMemo(
    () =>
      buildBrochureTemplatePreview({
        agency,
        listing,
        collateral,
        templateId: selectedTemplateId,
        collateralType,
      }),
    [agency, listing, collateral, selectedTemplateId, collateralType],
  );

  async function proceedToContentGeneration() {
    setSaving(true);

    const response = await fetch(`/api/collateral/${collateral.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: selectedTemplateId }),
    });
    const payload = (await response.json()) as ApiError & {
      collateral?: CollateralItem;
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to save template");
      setSaving(false);
      return;
    }

    if (payload.collateral) {
      onCollateralChange(payload.collateral);
    }

    setSaving(false);
    onContinue();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Choose template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose 1 or 2 pages, then pick a layout. Preview uses your listing photos
          and brand (sample copy until you generate content).
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="space-y-6">
          <SalesBrochureTemplatePicker
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            defaultTemplateId={defaultTemplateId}
            collateralType={collateralType}
          />

          <div className="flex flex-wrap gap-3">
            <Button onClick={proceedToContentGeneration} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Proceed to content generation"
              )}
            </Button>
          </div>
        </div>

        <div className="min-w-0">
          <FittedBrochurePreview
            document={previewDocument}
            listing={listing}
            collateralType={collateralType}
            maxHeight="min(85vh, 920px)"
          />
        </div>
      </div>
    </div>
  );
}
