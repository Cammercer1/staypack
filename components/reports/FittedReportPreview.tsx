"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { cn } from "@/lib/utils";
import type { FinalReportJson } from "@/lib/types";

const MM_TO_PX = 3.7795275591;
const A4_WIDTH_PX = 210 * MM_TO_PX;
const A4_HEIGHT_PX = 297 * MM_TO_PX;

type Props = {
  report: FinalReportJson;
  className?: string;
  maxHeight?: string;
};

export function FittedReportPreview({
  report,
  className,
  maxHeight = "calc(100vh - 12rem)",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [pageSize, setPageSize] = useState({
    width: A4_WIDTH_PX,
    height: A4_HEIGHT_PX,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const page = container.querySelector(".report-page") as HTMLElement | null;
      const width = page?.offsetWidth ?? A4_WIDTH_PX;
      const height = page?.offsetHeight ?? A4_HEIGHT_PX;

      if (!width || !height) return;

      setPageSize({ width, height });

      const padding = 16;
      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - padding;
      const nextScale = Math.min(
        availableWidth / width,
        availableHeight / height,
        1,
      );

      setScale(nextScale > 0 ? nextScale : 0.5);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    const page = container.querySelector(".report-page");
    if (page) observer.observe(page);

    return () => observer.disconnect();
  }, [report]);

  const scaledWidth = pageSize.width * scale;
  const scaledHeight = pageSize.height * scale;

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-sm",
        className,
      )}
      style={{ height: maxHeight, maxHeight }}
    >
      <div className="flex h-full w-full items-start justify-center p-2">
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
              width: pageSize.width,
            }}
          >
            <ReportPreview report={report} />
          </div>
        </div>
      </div>
    </div>
  );
}
