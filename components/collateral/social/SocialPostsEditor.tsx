"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, Download, Loader2, MoreHorizontal, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { SocialPostExportCapture } from "@/components/collateral/social/SocialPostExportCapture";
import { SocialPostLayerPanel } from "@/components/collateral/social/SocialPostLayerPanel";
import { SocialPostPreviewStage } from "@/components/collateral/social/SocialPostPreviewStage";
import {
  captureSocialPostPng,
  waitForSocialPostExportCanvas,
} from "@/lib/collateral/social/captureSocialPostPng";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SOCIAL_POST_VARIANT_IDS,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";
import { ensureSocialPostsDocument } from "@/lib/collateral/social/normalizeSocialDocument";
import {
  getLayersForVariant,
  setVariantLayers,
} from "@/lib/collateral/social/variantLayers";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";
import {
  getBrandAdvancedCssVars,
  resolveBrandAdvanced,
} from "@/lib/branding/advanced";
import {
  resolveBodyFontFamily,
  resolveHeadingFontFamily,
} from "@/lib/branding/google-fonts";
import { resolveCollateralGalleryUrls } from "@/lib/listings/collateralImages";
import type { Agency, CollateralItem, Listing } from "@/lib/types";

type Props = {
  listing: Listing;
  agency: Agency;
  collateral: CollateralItem;
};

export function SocialPostsEditor({ listing, agency, collateral: initialCollateral }: Props) {
  const [collateral, setCollateral] = useState(initialCollateral);
  const [document, setDocument] = useState(() =>
    ensureSocialPostsDocument(
      initialCollateral.document_json as SocialPostsDocumentJson,
    ),
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingVariant, setExportingVariant] = useState<SocialPostVariantId | "all" | null>(
    null,
  );
  const [exportCaptureVariant, setExportCaptureVariant] =
    useState<SocialPostVariantId | null>(null);
  const exportCaptureRootRef = useRef<HTMLDivElement>(null);

  const activeVariantId = document.active_variant_id;

  const backgroundOptions = useMemo(
    () => resolveCollateralGalleryUrls(listing, "social_posts"),
    [listing],
  );

  const agencySlice = document.agency;
  const headingFontId =
    agencySlice.heading_font_family || agencySlice.font_family || "fraunces";
  const bodyFontId = agencySlice.body_font_family || agencySlice.font_family || "inter";
  const headingFontFileUrl = agencySlice.heading_font_file_url || null;
  const bodyFontFileUrl =
    agencySlice.body_font_file_url || agencySlice.font_file_url || null;
  const headingFontFamily = resolveHeadingFontFamily(
    headingFontId,
    headingFontFileUrl,
  );
  const bodyFontFamily = resolveBodyFontFamily(bodyFontId, bodyFontFileUrl);
  const brandAdvanced = resolveBrandAdvanced({
    primary_colour: agencySlice.primary_colour,
    text_colour: agencySlice.text_colour,
    brand_advanced_json: agencySlice.brand_advanced ?? null,
  });

  const previewStyle = {
    ["--collateral-heading-font" as string]: headingFontFamily,
    ["--collateral-body-font" as string]: bodyFontFamily,
    ["--collateral-primary" as string]: agencySlice.primary_colour,
    ...getBrandAdvancedCssVars(brandAdvanced),
  };

  const saveDocument = useCallback(
    async (next: SocialPostsDocumentJson) => {
      setSaving(true);
      try {
        const response = await fetch(`/api/collateral/${collateral.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            active_variant_id: next.active_variant_id,
            agent: next.agent,
            listing: {
              bedrooms: next.listing.bedrooms,
              bathrooms: next.listing.bathrooms,
              car_spaces: next.listing.car_spaces,
              land_area_sqm: next.listing.land_area_sqm,
            },
            layers: getLayersForVariant(next, next.active_variant_id),
            variants: next.variants,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to save");
        }

        setCollateral(payload.collateral as CollateralItem);
        setDocument(
          ensureSocialPostsDocument(
            payload.collateral.document_json as SocialPostsDocumentJson,
          ),
        );
        toast.success("Saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save");
      } finally {
        setSaving(false);
      }
    },
    [collateral.id],
  );

  function handleVariantChange(variantId: SocialPostVariantId) {
    setDocument((current) => {
      const activeId = current.active_variant_id;
      const persisted = setVariantLayers(
        current,
        activeId,
        getLayersForVariant(current, activeId),
        {
          layoutCustomized:
            current.variants[activeId]?.layout_customized ?? true,
        },
      );
      return {
        ...persisted,
        active_variant_id: variantId,
        layers: getLayersForVariant(persisted, variantId),
      };
    });
  }

  async function handleSave() {
    await saveDocument(document);
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Regenerate social posts? This resets layers and backgrounds to defaults.",
      )
    ) {
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`/api/collateral/${collateral.id}/generate`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to regenerate");
      }

      setCollateral(payload.collateral as CollateralItem);
      setDocument(
        ensureSocialPostsDocument(
          payload.collateral.document_json as SocialPostsDocumentJson,
        ),
      );
      toast.success("Regenerated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to regenerate",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function runExport(variant: SocialPostVariantId) {
    flushSync(() => setExportCaptureVariant(variant));
    try {
      const canvas = await waitForSocialPostExportCanvas(
        () => exportCaptureRootRef.current,
      );
      const pngBlob = await captureSocialPostPng(canvas, variant);
      const formData = new FormData();
      formData.append("variant", variant);
      formData.append("png", pngBlob, `${variant}.png`);

      const response = await fetch(`/api/collateral/${collateral.id}/export-png`, {
        method: "POST",
        body: formData,
      });
      const raw = await response.text();
      let payload: { error?: string; png_url?: string; collateral?: CollateralItem };
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(
          response.status === 413
            ? "PNG file is too large to upload"
            : `Export failed (${response.status})`,
        );
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to export PNG");
      }

      const updatedCollateral = payload.collateral;
      if (!updatedCollateral) {
        throw new Error("Export succeeded but collateral was not returned");
      }

      const pngUrl = payload.png_url;
      if (!pngUrl) {
        throw new Error("Export succeeded but PNG URL was not returned");
      }

      setCollateral(updatedCollateral);
      setDocument(
        ensureSocialPostsDocument(
          updatedCollateral.document_json as SocialPostsDocumentJson,
        ),
      );

      const link = window.document.createElement("a");
      link.href = pngUrl;
      link.download = `${listing.property_address ?? "property"}-${variant}.png`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } finally {
      setExportCaptureVariant(null);
    }
  }

  async function exportVariant(variant: SocialPostVariantId) {
    setExportingVariant(variant);
    try {
      await runExport(variant);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to export PNG",
      );
    } finally {
      setExportingVariant(null);
    }
  }

  async function handleExportAll() {
    setExportingVariant("all");
    try {
      for (const variantId of SOCIAL_POST_VARIANT_IDS) {
        await runExport(variantId);
      }
      toast.success("All formats exported");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to export PNG",
      );
    } finally {
      setExportingVariant(null);
    }
  }

  const busy = saving || generating || exportingVariant != null;

  return (
    <div className="flex h-[calc(100dvh-4rem-5rem)] max-h-[calc(100dvh-4rem-5rem)] flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/listings/${listing.id}`}>
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to listing</span>
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Social posts
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {listing.property_address ?? "Listing"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={busy}>
            {saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportVariant(activeVariantId)}
            disabled={busy}
          >
            {exportingVariant === activeVariantId ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon-sm" disabled={busy}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRegenerate} disabled={generating}>
                <RefreshCw className="h-4 w-4" />
                Regenerate all
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAll} disabled={busy}>
                <Download className="h-4 w-4" />
                Export all formats
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border/60 lg:max-w-[58%] lg:border-b-0 lg:border-r">
          <SocialPostPreviewStage
            document={document}
            activeVariantId={activeVariantId}
            previewStyle={previewStyle}
            fonts={{
              heading_font_family: headingFontId,
              body_font_family: bodyFontId,
              heading_font_file_url: headingFontFileUrl,
              body_font_file_url: bodyFontFileUrl,
            }}
            measureFonts={{
              headingFontFamily: headingFontFamily,
              bodyFontFamily: bodyFontFamily,
            }}
            onVariantChange={handleVariantChange}
          />
        </div>

        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:w-[42%] lg:max-w-md">
          <div className="shrink-0 border-b border-border/50 px-4 py-2.5">
            <p className="text-sm font-medium">Layers</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
            <SocialPostLayerPanel
              document={document}
              listing={listing}
              backgroundOptions={backgroundOptions}
              onChange={setDocument}
            />
          </div>
        </aside>
      </div>

      <div
        ref={exportCaptureRootRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0"
      >
        {exportCaptureVariant ? (
          <SocialPostExportCapture
            variantId={exportCaptureVariant}
            document={document}
            previewStyle={previewStyle}
            fonts={{
              heading_font_family: headingFontId,
              body_font_family: bodyFontId,
              heading_font_file_url: headingFontFileUrl,
              body_font_file_url: bodyFontFileUrl,
            }}
            measureFonts={{
              headingFontFamily,
              bodyFontFamily,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
