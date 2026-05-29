"use client";

import { BUSINESS_CARD_VARIANTS, BUSINESS_CARD_VARIANT_IDS, type BusinessCardVariantId } from "@/lib/collateral/business-card/formats";
import { cn } from "@/lib/utils";

type Props = {
  activeVariantId: BusinessCardVariantId;
  onVariantChange: (variantId: BusinessCardVariantId) => void;
};

export function BusinessCardFacePicker({
  activeVariantId,
  onVariantChange,
}: Props) {
  const active = BUSINESS_CARD_VARIANTS[activeVariantId];

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{active.label}</p>
        <p className="text-xs text-muted-foreground">{active.description}</p>
      </div>
      <div
        className="inline-flex w-full rounded-lg bg-muted/80 p-0.5"
        role="group"
        aria-label="Business card side"
      >
        {BUSINESS_CARD_VARIANT_IDS.map((variantId) => (
          <button
            key={variantId}
            type="button"
            onClick={() => onVariantChange(variantId)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeVariantId === variantId
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {BUSINESS_CARD_VARIANTS[variantId].label}
          </button>
        ))}
      </div>
    </div>
  );
}
