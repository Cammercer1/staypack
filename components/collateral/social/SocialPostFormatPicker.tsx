"use client";

import { RectangleHorizontal, Smartphone, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_VARIANT_IDS,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";

const formatIcons = {
  square: Square,
  wide: RectangleHorizontal,
  story: Smartphone,
};

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
    <div className="space-y-2.5">
      <div
        className="grid grid-cols-3 gap-1 rounded-xl bg-base-200 p-1"
        role="group"
        aria-label="Post format"
      >
        {SOCIAL_POST_VARIANT_IDS.map((variantId) => {
          const Icon = formatIcons[variantId];
          return (
            <button
              key={variantId}
              type="button"
              aria-pressed={activeVariantId === variantId}
              onClick={() => onVariantChange(variantId)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                activeVariantId === variantId
                  ? "bg-base-100 text-base-content shadow-sm"
                  : "text-base-content/60 hover:bg-base-100/50 hover:text-base-content",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {SOCIAL_POST_FORMATS[variantId].label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-base-content/65">
        <p>
          {activeVariantId === "square"
            ? "Instagram & Facebook feed"
            : activeVariantId === "wide"
              ? "Facebook & LinkedIn posts"
              : "Instagram & Facebook stories"}
        </p>
        <p className="tabular-nums">
          {active.widthPx} × {active.heightPx} px
        </p>
      </div>
    </div>
  );
}
