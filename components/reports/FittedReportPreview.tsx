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
  const paginated = pageCount > 1;
  const [scale, setScale] = useState(0.5);
  const [currentPage, setCurrentPage] = useState(0);
  const fitToPanel = maxHeight !== "none";

  useLayoutEffect(() => {
    setCurrentPage(0);
  }, [report.template_id, pageCount]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const padding = 16;
      const availableWidth = container.clientWidth - padding;
      const heightToFit = paginated ? pageHeightPx : contentHeightPx;
      const availableHeight = fitToPanel
        ? container.clientHeight - padding
        : heightToFit;

      const nextScale = fitToWidth
        ? Math.min(availableWidth / pageWidthPx, 1)
        : Math.min(
            availableWidth / pageWidthPx,
            fitToPanel ? availableHeight / heightToFit : availableWidth / pageWidthPx,
            1,
          );

      setScale(nextScale > 0 ? nextScale : 0.5);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [
    report,
    orientation,
    contentHeightPx,
    fitToPanel,
    fitToWidth,
    pageHeightPx,
    pageWidthPx,
    paginated,
  ]);

  const scaledWidth = pageWidthPx * scale;
  const scaledHeight = (paginated ? pageHeightPx : contentHeightPx) * scale;
  const canGoBack = currentPage > 0;
  const canGoForward = currentPage < pageCount - 1;

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-xl border bg-white shadow-sm",
        paginated ? "flex flex-col" : "",
        paginated || !fitToWidth
          ? "overflow-hidden"
          : "overflow-x-hidden overflow-y-auto",
        className,
      )}
      style={fitToPanel ? { height: maxHeight, maxHeight } : undefined}
    >
      {paginated ? (
        <div className="flex items-center justify-between border-b bg-muted/70 px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
            disabled={!canGoBack}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Preview page
            </span>
            <div className="flex items-center gap-2">
              {Array.from({ length: pageCount }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    index === currentPage ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-foreground">
              Page {currentPage + 1} of {pageCount}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount - 1, page + 1))
            }
            disabled={!canGoForward}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      ) : null}
      <div
        className={cn(
          "flex w-full justify-center p-2",
          paginated
            ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
            : "",
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
            <div
              style={{
                transform: paginated
                  ? `translateY(-${currentPage * pageHeightPx}px)`
                  : undefined,
              }}
            >
              <ReportPreview report={report} printMode orientation={orientation} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
