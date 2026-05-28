"use client";

import { cn } from "@/lib/utils";
import {
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_VARIANT_IDS,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";

type Props = {
  activeVariantId: SocialPostVariantId;
  onVariantChange: (variantId: SocialPostVariantId) => void;
};

export function SocialPostFormatPicker({
  activeVariantId,
  onVariantChange,
}: Props) {
  const active = SOCIAL_POST_FORMATS[activeVariantId];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{active.label}</p>
          <p className="text-xs text-muted-foreground">{active.description}</p>
        </div>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {active.widthPx}×{active.heightPx}
        </p>
      </div>

      <div
        className="inline-flex w-full rounded-lg bg-muted/80 p-0.5"
        role="group"
        aria-label="Post format"
      >
        {SOCIAL_POST_VARIANT_IDS.map((variantId) => {
          const format = SOCIAL_POST_FORMATS[variantId];
          return (
            <button
              key={variantId}
              type="button"
              onClick={() => onVariantChange(variantId)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                activeVariantId === variantId
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {format.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
