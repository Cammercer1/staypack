"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BusinessCardFacePicker } from "@/components/collateral/business-card/BusinessCardFacePicker";
import { CollateralPreview } from "@/components/collateral/CollateralPreview";
import type { BusinessCardVariantId } from "@/lib/collateral/business-card/formats";
import type { BusinessCardDocumentJson } from "@/lib/collateral/templates/types";

type Props = {
  document: BusinessCardDocumentJson;
  activeVariantId: BusinessCardVariantId;
  onVariantChange: (variantId: BusinessCardVariantId) => void;
};

// 90mm × 55mm at 96 dpi reference (1mm ≈ 3.7795px)
const CARD_W = 340;
const CARD_H = 208;

export function BusinessCardPreviewStage({
  document,
  activeVariantId,
  onVariantChange,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 500, height: 400 });

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const update = () => {
      setViewportSize({ width: node.clientWidth, height: node.clientHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    const padX = 64;
    const padY = 64;
    return Math.min(
      2.2,
      Math.max(0.4, (viewportSize.width - padX) / CARD_W),
      Math.max(0.4, (viewportSize.height - padY) / CARD_H),
    );
  }, [viewportSize.height, viewportSize.width]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/50 px-4 py-3">
        <BusinessCardFacePicker
          activeVariantId={activeVariantId}
          onVariantChange={onVariantChange}
        />
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 p-8"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div
          className="shrink-0 rounded-[3px] shadow-[0_8px_40px_rgba(0,0,0,0.18)] ring-1 ring-border/40"
          style={{
            width: CARD_W * fitScale,
            height: CARD_H * fitScale,
            overflow: "hidden",
          }}
        >
          <div
            className="origin-top-left"
            style={{
              width: CARD_W,
              height: CARD_H,
              transform: `scale(${fitScale})`,
            }}
          >
            <CollateralPreview
              document={document}
              collateralType="agent_business_card"
              variantId={activeVariantId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
