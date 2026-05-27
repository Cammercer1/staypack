"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { cn } from "@/lib/utils";
import {
  getReportPageFormat,
  mmToPx,
  type ReportPageOrientation,
} from "@/lib/reports/pageFormat";
import { getReportTemplate } from "@/lib/reports/templates/registry";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  report: FinalReportJson;
  className?: string;
  maxHeight?: string;
  orientation?: ReportPageOrientation;
  /** Scale to container width and scroll vertically instead of shrinking to fit height. */
  fitToWidth?: boolean;
};

export function FittedReportPreview({
  report,
  className,
  maxHeight = "calc(100vh - 12rem)",
  orientation = "portrait",
  fitToWidth = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageFormat = getReportPageFormat(orientation);
  const pageWidthPx = mmToPx(pageFormat.widthMm);
  const pageHeightPx = mmToPx(pageFormat.heightMm);
  const pageCount = getReportTemplate(report.template_id).pages;
  const contentHeightPx = pageHeightPx * pageCount;
  const [scale, setScale] = useState(0.5);
  const fitToPanel = maxHeight !== "none";

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
  }, [report, orientation, contentHeightPx, fitToPanel, fitToWidth, pageWidthPx]);

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
            <ReportPreview report={report} printMode orientation={orientation} />
          </div>
        </div>
      </div>
    </div>
  );
}
