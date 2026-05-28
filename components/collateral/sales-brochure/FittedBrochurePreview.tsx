"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CollateralPreview } from "@/components/collateral/CollateralPreview";
import {
  applySalesBrochurePreviewBrand,
  getSalesBrochurePreviewBrandFixture,
  type SalesBrochurePreviewBrand,
} from "@/lib/collateral/sales-brochure/previewBrand";
import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import { getCollateralTemplate } from "@/lib/collateral/templates/registry";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { mmToPx } from "@/lib/reports/pageFormat";
import { cn } from "@/lib/utils";

type Props = {
  document: SalesBrochureDocumentJson;
  className?: string;
  maxHeight?: string;
  fitToWidth?: boolean;
};

export function FittedBrochurePreview({
  document,
  className,
  maxHeight = "min(80vh, 900px)",
  fitToWidth = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const template = getCollateralTemplate(document.template_id);
  const pageFormat = getCollateralPageFormat(template.pageFormat);
  const pageWidthPx = mmToPx(pageFormat.widthMm);
  const pageHeightPx = mmToPx(pageFormat.heightMm);
  const pageCount = template.pages;
  const contentHeightPx = pageHeightPx * pageCount;
  const [scale, setScale] = useState(0.5);
  const [previewBrand, setPreviewBrand] = useState<SalesBrochurePreviewBrand>(
    getSalesBrochurePreviewBrandFixture,
  );
  const fitToPanel = maxHeight !== "none";

  useEffect(() => {
    let cancelled = false;

    fetch("/api/collateral/preview-brand")
      .then((response) => response.json())
      .then((payload: SalesBrochurePreviewBrand & { error?: string }) => {
        if (!cancelled && payload.agency && payload.agent) {
          setPreviewBrand({ agency: payload.agency, agent: payload.agent });
        }
      })
      .catch(() => {
        // Keep fixture fallback
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const previewDocument = useMemo((): SalesBrochureDocumentJson => {
    const merged = applySalesBrochurePreviewBrand(document, previewBrand);
    return isSalesBrochureDocument(merged) ? merged : document;
  }, [document, previewBrand]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const padding = 16;
      const availableWidth = container.clientWidth - padding;
      const availableHeight = fitToPanel
        ? container.clientHeight - padding
        : contentHeightPx;

      const nextScale = fitToWidth
        ? Math.min(availableWidth / pageWidthPx, 1)
        : Math.min(
            availableWidth / pageWidthPx,
            fitToPanel ? availableHeight / contentHeightPx : availableWidth / pageWidthPx,
            1,
          );

      setScale(nextScale > 0 ? nextScale : 0.5);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [previewDocument, contentHeightPx, fitToPanel, fitToWidth, pageWidthPx]);

  const scaledWidth = pageWidthPx * scale;
  const scaledHeight = contentHeightPx * scale;

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-xl border bg-white shadow-sm",
        fitToWidth ? "overflow-x-hidden overflow-y-auto" : "overflow-hidden",
        className,
      )}
      style={fitToPanel ? { height: maxHeight, maxHeight } : undefined}
    >
      <div
        className={cn(
          "flex w-full justify-center p-2",
          fitToPanel && !fitToWidth ? "h-full items-start" : "items-start py-4",
        )}
      >
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: pageWidthPx,
              height: contentHeightPx,
            }}
          >
            <CollateralPreview
              document={previewDocument}
              collateralType="sales_brochure"
              printMode
            />
          </div>
        </div>
      </div>
    </div>
  );
}
