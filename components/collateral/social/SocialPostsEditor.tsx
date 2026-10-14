"use client";

import { CreateAnother, PropertyContext } from "@/components/properties/PropertyContext";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
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
import { packageSocialImages } from "@/lib/collateral/social/packageSocialImages";
import { socialSavePayload } from "@/lib/collateral/social/savePayload";
import { mergeAgencyBrandIntoSocialPostsDocument } from "@/lib/collateral/mergeAgencyBrand";
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
  const [savedDocumentJson, setSavedDocumentJson] = useState(() => JSON.stringify(document));
  const [exportError, setExportError] = useState("");
  const [exportProgress, setExportProgress] = useState("");
  const [retryVariants, setRetryVariants] = useState<SocialPostVariantId[]>([]);
  const operation = useRef(false);
  const preparedImages = useRef(new Map<SocialPostVariantId, Blob>());
  const dirty = JSON.stringify(document) !== savedDocumentJson;
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingVariant, setExportingVariant] = useState<SocialPostVariantId | "all" | null>(
    null,
  );
  const [exportCapture, setExportCapture] = useState<{
    variantId: SocialPostVariantId;
    document: SocialPostsDocumentJson;
  } | null>(null);
  const exportCaptureRootRef = useRef<HTMLDivElement>(null);

  const documentWithLiveBrand = useMemo(
    () => mergeAgencyBrandIntoSocialPostsDocument(agency, document),
    [agency, document],
  );

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

  const persistDocument = useCallback(
    async (next: SocialPostsDocumentJson) => {
      const response = await fetch(`/api/collateral/${collateral.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(socialSavePayload(next, ensureSocialPostsDocument(collateral.document_json as SocialPostsDocumentJson))),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save");
      }

      const saved = payload.collateral as CollateralItem;
      const savedDocument = ensureSocialPostsDocument(
        saved.document_json as SocialPostsDocumentJson,
      );
      setCollateral(saved);
      setDocument(savedDocument);
      setSavedDocumentJson(JSON.stringify(savedDocument));
      return savedDocument;
    },
    [collateral.id, collateral.document_json],
  );

  const saveDocument = useCallback(
    async (next: SocialPostsDocumentJson) => {
      if (operation.current) return;
      operation.current = true;
      setExportError("");
      setSaving(true);
      try {
        await persistDocument(next);
        toast.success("Saved");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save";
        setExportError(message); toast.error(message);
      } finally {
        setSaving(false); operation.current = false;
      }
    },
    [persistDocument],
  );

  function clearPendingDownloads() {
    preparedImages.current.clear();
    setRetryVariants([]);
    setExportProgress("");
  }

  function handleVariantChange(variantId: SocialPostVariantId) {
    clearPendingDownloads();
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
    if (operation.current) return;
    if (
      !window.confirm(
        "Regenerate social posts? This resets layers and backgrounds to defaults.",
      )
    ) {
      return;
    }

    operation.current = true; setExportError(""); clearPendingDownloads();
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
      const regenerated = ensureSocialPostsDocument(payload.collateral.document_json as SocialPostsDocumentJson);
      setDocument(regenerated); setSavedDocumentJson(JSON.stringify(regenerated));
      toast.success("Regenerated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to regenerate",
      );
    } finally {
      setGenerating(false); operation.current = false;
    }
  }

  async function runExport(variant: SocialPostVariantId, savedDocument: SocialPostsDocumentJson) {
    const exportDocument = mergeAgencyBrandIntoSocialPostsDocument(
      agency,
      savedDocument,
    );

    flushSync(() => setExportCapture({ variantId: variant, document: exportDocument }));
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

      setCollateral(updatedCollateral);
      const exported = ensureSocialPostsDocument(updatedCollateral.document_json as SocialPostsDocumentJson);
      setDocument(exported); setSavedDocumentJson(JSON.stringify(exported));

      return pngBlob;
    } finally {
      setExportCapture(null);
    }
  }

  async function exportVariants(variants: SocialPostVariantId[], resume = false) {
    if (operation.current) return;
    operation.current = true;
    if (!resume) preparedImages.current.clear();
    setExportingVariant(variants.length === 1 ? variants[0] : "all");
    setExportError(""); setRetryVariants([]);
    let completed = 0;
    try {
      const saved = await persistDocument(document);
      for (const variant of variants) {
        setExportProgress(`Preparing ${variant} image (${completed + 1} of ${variants.length})…`);
        preparedImages.current.set(variant, await runExport(variant, saved));
        completed++;
      }
      const { blob, filename } = await packageSocialImages(listing.property_address ?? "property", preparedImages.current);
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
      const count = preparedImages.current.size;
      setExportProgress(count === 1 ? "Image downloaded." : `${count} images downloaded in one ZIP.`);
      preparedImages.current.clear();
      toast.success(count === 1 ? "Image downloaded" : "All formats downloaded");
    } catch (error) {
      setRetryVariants(variants.slice(completed));
      const count = preparedImages.current.size;
      setExportProgress(count ? `${count} image${count === 1 ? "" : "s"} prepared. Retry to finish your download.` : "");
      const message = error instanceof Error ? error.message : "Unable to download images";
      setExportError(message); toast.error(message);
    } finally {
      setExportingVariant(null); operation.current = false;
    }
  }

  const busy = saving || generating || exportingVariant != null;

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      <UnsavedListingGuard dirty={dirty} description="Your social design has unsaved changes. Save it before leaving." />
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/social">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to social media</span>
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Social media posts
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {listing.property_address ?? "Listing"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={busy}>
            {saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button
            size="sm"
            onClick={() => void exportVariants([activeVariantId])}
            disabled={busy}
          >
            {exportingVariant === activeVariantId ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download image
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void exportVariants([...SOCIAL_POST_VARIANT_IDS])}>Download all formats</Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon-sm" disabled={busy} aria-label="More social actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRegenerate} disabled={generating}>
                <RefreshCw className="h-4 w-4" />
                Regenerate all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div inert={busy}><PropertyContext listing={listing} editHref={`/social/${collateral.id}/property`} /></div>
      <p role="status" className="text-sm text-muted-foreground">{exportProgress || (dirty ? "Unsaved changes" : "All changes saved")}</p>
      {exportError && <div role="alert" className="space-y-3 rounded-xl border border-destructive p-4"><p>{exportError}</p>{retryVariants.length > 0 && <Button variant="outline" disabled={busy} onClick={() => void exportVariants(retryVariants, true)}>Retry remaining downloads</Button>}</div>}
      <div inert={busy} className="flex min-h-[40rem] flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:h-[44rem] lg:flex-row">
        <div className="flex min-h-[25rem] flex-1 flex-col overflow-hidden border-b border-border/60 lg:max-w-[58%] lg:border-b-0 lg:border-r">
          <SocialPostPreviewStage
            document={documentWithLiveBrand}
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

        <aside className="flex h-[32rem] min-h-0 w-full lg:h-auto shrink-0 flex-col overflow-hidden lg:w-[42%] lg:max-w-md">
          <div className="shrink-0 border-b border-border/50 px-4 py-2.5">
            <p className="text-sm font-medium">Layers</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
            <SocialPostLayerPanel
              document={documentWithLiveBrand}
              listing={listing}
              backgroundOptions={backgroundOptions}
              onChange={(next) => { clearPendingDownloads(); setDocument(next); }}
            />
          </div>
        </aside>
      </div>

      {!busy && <CreateAnother listingId={listing.id} />}
      <div
        ref={exportCaptureRootRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0"
      >
        {exportCapture ? (
          <SocialPostExportCapture
            variantId={exportCapture.variantId}
            document={exportCapture.document}
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
