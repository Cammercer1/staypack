"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { mmToPx } from "@/lib/reports/pageFormat";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { OC_REAL_ESTATE_STR_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { OcRealEstateStrPageOne } from "@/lib/reports/templates/oc-real-estate/OcRealEstateStrTemplate";
import { OcRealEstateStrPageTwo } from "@/lib/reports/templates/oc-real-estate/OcRealEstateStrPageTwo";
import type { FinalReportJson } from "@/lib/types";

const PAGE_WIDTH_PX = mmToPx(210);
const PAGE_HEIGHT_PX = mmToPx(297);

export function OcStrAppraisalConceptPreview({
  report,
  maxHeight = "calc(100vh - 11.25rem)",
}: {
  report: FinalReportJson;
  maxHeight?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [currentPage, setCurrentPage] = useState<0 | 1>(0);
  const displayReport = useMemo(
    () =>
      resolveFinalReportForDisplay({
        ...report,
        template_id: OC_REAL_ESTATE_STR_TEMPLATE_ID,
      }),
    [report],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const padding = 24;
      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - padding;
      const nextScale = Math.min(
        availableWidth / PAGE_WIDTH_PX,
        availableHeight / PAGE_HEIGHT_PX,
        1,
      );
      setScale(nextScale > 0 ? nextScale : 0.6);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-xl border border-neutral-300 bg-white/50 shadow-sm"
      style={{ height: maxHeight, maxHeight }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-300 bg-white/90 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setCurrentPage(0)}
          disabled={currentPage === 0}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm enabled:hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          ← Page 1
        </button>
        <div className="text-center">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-neutral-500">
            Working document
          </p>
          <p className="text-xs font-semibold text-neutral-800">
            Page {currentPage + 1} of 2
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm enabled:hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Page 2 →
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3"
      >
        <div
          className="shrink-0 overflow-hidden shadow-xl"
          style={{ width: PAGE_WIDTH_PX * scale, height: PAGE_HEIGHT_PX * scale }}
        >
          <div
            style={{
              width: PAGE_WIDTH_PX,
              height: PAGE_HEIGHT_PX,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {currentPage === 0 ? (
              <OcRealEstateStrPageOne report={displayReport} />
            ) : (
              <OcRealEstateStrPageTwo report={displayReport} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
