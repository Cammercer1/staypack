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
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import { enrichSalesBrochureDocumentAgents } from "@/lib/collateral/enrichSalesBrochureDocument";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";
import { mmToPx } from "@/lib/reports/pageFormat";
import { cn } from "@/lib/utils";
import { resolveListingImageMetaForPool } from "@/lib/listings/syncListingImageMeta";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";
import type { AgentProfile, FinalReportJson, Listing } from "@/lib/types";
import {
  EditableProvider,
  type BrochureImageSlot,
} from "@/components/collateral/sales-brochure/inline/EditableContext";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import type { MutableRefObject } from "react";

type Props = {
  document: BrochureDocumentJson;
  listing?: Pick<
    Listing,
    | "scraped_listing_json"
    | "agent_profile_id"
    | "uploaded_image_urls"
    | "listing_image_meta"
  > | null;
  agencyAgents?: AgentProfile[];
  agentProfile?: AgentProfile | null;
  collateralType?: BrochureDocumentJson["type"];
  className?: string;
  maxHeight?: string;
  fitToWidth?: boolean;
  /** When true, use agency/fonts from `document` (listing playground) instead of session preview-brand API. */
  useDocumentBrand?: boolean;
  metricsReport?: FinalReportJson;
  reportVariant?: ReportPageVariant;
  allowDevBlurbLengthMap?: boolean;
  editable?: {
    blurbBlocks: BrochureBlurbBlock[];
    setField: (path: BrochureCopyFieldPath, value: string) => void;
    setBlurbBlocks: (blocks: BrochureBlurbBlock[]) => void;
    openImagePicker: (slot: BrochureImageSlot) => void;
    blurbFlushRef?: MutableRefObject<(() => BrochureBlurbBlock[] | null) | null>;
  };
};

export function FittedBrochurePreview({
  document,
  listing = null,
  agencyAgents = [],
  agentProfile = null,
  collateralType = document.type,
  className,
  maxHeight = "min(80vh, 900px)",
  fitToWidth = true,
  useDocumentBrand = false,
  metricsReport,
  reportVariant,
  allowDevBlurbLengthMap = false,
  editable,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const template = getCollateralTemplate(document.template_id);
  const pageFormat = getCollateralPageFormat(template.pageFormat);
  const pageWidthPx = mmToPx(pageFormat.widthMm);
  const pageHeightPx = mmToPx(pageFormat.heightMm);
  const pageCount = template.pages;
  const contentHeightPx = pageHeightPx * pageCount;
  const paginated = pageCount > 1;
  const [scale, setScale] = useState(0.5);
  const [currentPage, setCurrentPage] = useState(0);
  const [previewBrand, setPreviewBrand] = useState<SalesBrochurePreviewBrand>(
    getSalesBrochurePreviewBrandFixture,
  );
  const fitToPanel = maxHeight !== "none";

  useEffect(() => {
    setCurrentPage(0);
  }, [document.template_id, pageCount]);

  useEffect(() => {
    if (useDocumentBrand) {
      return;
    }

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
  }, [useDocumentBrand]);

  const previewDocument = useMemo((): BrochureDocumentJson => {
    const withListingAgents = listing
      ? enrichSalesBrochureDocumentAgents(document, listing, {
          agencyAgents,
          agentProfile,
        })
      : document;
    const merged = useDocumentBrand
      ? withListingAgents
      : applySalesBrochurePreviewBrand(withListingAgents, previewBrand);
    if (!isBrochureDocument(merged)) {
      return withListingAgents;
    }

    const listingMeta = listing
      ? resolveListingImageMetaForPool(listing)
      : merged.listing_image_meta;

    return {
      ...merged,
      listing_image_meta: listingMeta ?? merged.listing_image_meta ?? {},
    };
  }, [document, listing, agencyAgents, agentProfile, previewBrand, useDocumentBrand]);

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
    previewDocument,
    contentHeightPx,
    fitToPanel,
    fitToWidth,
    pageHeightPx,
    pageWidthPx,
    paginated,
  ]);

  const displayScale = scale;
  const scaledWidth = pageWidthPx * displayScale;
  const scaledHeight = (paginated ? pageHeightPx : contentHeightPx) * displayScale;
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
          className={editable ? "sales-brochure-inline-edit" : undefined}
          style={{
            width: scaledWidth,
            height: scaledHeight,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transform: `scale(${displayScale})`,
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
              {editable ? (
                <EditableProvider
                  blurbBlocks={editable.blurbBlocks}
                  brandPrimaryColour={
                    previewDocument.agency.primary_colour || "#095b42"
                  }
                  setField={editable.setField}
                  setBlurbBlocks={editable.setBlurbBlocks}
                  openImagePicker={editable.openImagePicker}
                  blurbFlushRef={editable.blurbFlushRef}
                >
                  <CollateralPreview
                    document={previewDocument}
                    collateralType={collateralType}
                    metricsReport={metricsReport}
                    reportVariant={reportVariant}
                    allowDevBlurbLengthMap={allowDevBlurbLengthMap}
                    printMode
                  />
                </EditableProvider>
              ) : (
                <CollateralPreview
                  document={previewDocument}
                  collateralType={collateralType}
                  metricsReport={metricsReport}
                  reportVariant={reportVariant}
                  allowDevBlurbLengthMap={allowDevBlurbLengthMap}
                  printMode
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
