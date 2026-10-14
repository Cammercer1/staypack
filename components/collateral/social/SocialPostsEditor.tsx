"use client";

import Link from "next/link";
import {
  CreateAnother,
  PropertyContext,
} from "@/components/properties/PropertyContext";
import { packageSocialImages } from "@/lib/collateral/social/packageSocialImages";
import { socialSavePayload } from "@/lib/collateral/social/savePayload";
import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  Check,
  Circle,
  Download,
  Eye,
  Image,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Redo2,
  Save,
  Type,
  BadgeCheck,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { SocialPostExportCapture } from "@/components/collateral/social/SocialPostExportCapture";
import { SocialPostLayerPanel } from "@/components/collateral/social/SocialPostLayerPanel";
import { SocialPostPreviewStage } from "@/components/collateral/social/SocialPostPreviewStage";
import {
  captureSocialPostPng,
  waitForSocialPostExportCanvas,
} from "@/lib/collateral/social/captureSocialPostPng";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import {
  socialPostContentKey,
  socialPostDraftReducer,
  type SocialPostDocumentUpdate,
} from "./socialPostDraft";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_VARIANT_IDS,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";
import { mergeAgencyBrandIntoSocialPostsDocument } from "@/lib/collateral/mergeAgencyBrand";
import { ensureSocialPostsDocument } from "@/lib/collateral/social/normalizeSocialDocument";
import { getLayersForVariant } from "@/lib/collateral/social/variantLayers";
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

export function SocialPostsEditor({
  listing,
  agency,
  collateral: initialCollateral,
}: Props) {
  const [collateral, setCollateral] = useState(initialCollateral);
  const [draft, dispatch] = useReducer(
    socialPostDraftReducer,
    initialCollateral,
    (item) => ({
      document: ensureSocialPostsDocument(
        item.document_json as SocialPostsDocumentJson,
      ),
      past: [],
      future: [],
    }),
  );
  const document = draft.document;
  const [savedContent, setSavedContent] = useState(() =>
    socialPostContentKey(document),
  );
  const [exportError, setExportError] = useState("");
  const [exportProgress, setExportProgress] = useState("");
  const [retryVariants, setRetryVariants] = useState<SocialPostVariantId[]>([]);
  const operation = useRef(false);
  const preparedImages = useRef(new Map<SocialPostVariantId, Blob>());
  const clearPendingDownloads = useCallback(() => {
    preparedImages.current.clear();
    setRetryVariants([]);
    setExportProgress("");
    setExportError("");
  }, []);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<
    "photos" | "wording" | "branding"
  >("photos");
  const dirty = socialPostContentKey(document) !== savedContent;
  const changeDocument = useCallback(
    (update: SocialPostDocumentUpdate) => {
      if (operation.current) return;
      clearPendingDownloads();
      dispatch({ type: "edit", update });
    },
    [clearPendingDownloads],
  );
  const replaceDocument = useCallback((next: SocialPostsDocumentJson) => {
    dispatch({ type: "replace", document: next });
    setSavedContent(socialPostContentKey(next));
    setSaveError(null);
  }, []);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingVariant, setExportingVariant] = useState<
    SocialPostVariantId | "all" | null
  >(null);
  const [exportCapture, setExportCapture] = useState<{
    variantId: SocialPostVariantId;
    document: SocialPostsDocumentJson;
  } | null>(null);
  const exportCaptureRootRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLElement>(null);

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
  const bodyFontId =
    agencySlice.body_font_family || agencySlice.font_family || "inter";
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
        body: JSON.stringify(
          socialSavePayload(
            next,
            ensureSocialPostsDocument(
              collateral.document_json as SocialPostsDocumentJson,
            ),
          ),
        ),
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
      replaceDocument(savedDocument);
      return savedDocument;
    },
    [collateral.id, collateral.document_json, replaceDocument],
  );

  const saveDocument = useCallback(
    async (next: SocialPostsDocumentJson) => {
      if (operation.current) return;
      operation.current = true;
      setExportError("");
      setSaving(true);
      setSaveError(null);
      try {
        await persistDocument(next);
        toast.success("Saved");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save";
        setSaveError(message);
        toast.error(message);
      } finally {
        setSaving(false);
        operation.current = false;
      }
    },
    [persistDocument],
  );

  function handleVariantChange(variantId: SocialPostVariantId) {
    if (operation.current) return;
    clearPendingDownloads();
    dispatch({
      type: "navigate",
      update: (current) => ({
        ...current,
        active_variant_id: variantId,
        layers: getLayersForVariant(current, variantId),
      }),
    });
  }

  async function handleSave() {
    await saveDocument(document);
  }

  async function handleRegenerate() {
    if (operation.current) return;
    if (
      !window.confirm(
        "Restore the original designs? This replaces your edits in all three formats.",
      )
    ) {
      return;
    }

    operation.current = true;
    clearPendingDownloads();
    setGenerating(true);
    try {
      const response = await fetch(
        `/api/collateral/${collateral.id}/generate`,
        {
          method: "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to regenerate");
      }

      setCollateral(payload.collateral as CollateralItem);
      replaceDocument(
        ensureSocialPostsDocument(
          payload.collateral.document_json as SocialPostsDocumentJson,
        ),
      );
      toast.success("Original designs restored");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to regenerate",
      );
    } finally {
      setGenerating(false);
      operation.current = false;
    }
  }

  async function runExport(
    variant: SocialPostVariantId,
    savedDocument: SocialPostsDocumentJson,
  ) {
    const exportDocument = mergeAgencyBrandIntoSocialPostsDocument(
      agency,
      savedDocument,
    );

    flushSync(() =>
      setExportCapture({ variantId: variant, document: exportDocument }),
    );
    try {
      const canvas = await waitForSocialPostExportCanvas(
        () => exportCaptureRootRef.current,
      );
      const pngBlob = await captureSocialPostPng(canvas, variant);
      const formData = new FormData();
      formData.append("variant", variant);
      formData.append("png", pngBlob, `${variant}.png`);

      const response = await fetch(
        `/api/collateral/${collateral.id}/export-png`,
        {
          method: "POST",
          body: formData,
        },
      );
      const raw = await response.text();
      let payload: {
        error?: string;
        png_url?: string;
        collateral?: CollateralItem;
      };
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
      const exported = ensureSocialPostsDocument(
        updatedCollateral.document_json as SocialPostsDocumentJson,
      );
      replaceDocument(exported);

      return pngBlob;
    } finally {
      setExportCapture(null);
    }
  }

  async function exportVariants(
    variants: SocialPostVariantId[],
    resume = false,
  ) {
    if (operation.current) return;
    operation.current = true;
    if (!resume) preparedImages.current.clear();
    setExportingVariant(variants.length === 1 ? variants[0] : "all");
    setExportError("");
    setRetryVariants([]);
    let completed = 0;
    try {
      const saved = await persistDocument(document);
      for (const variant of variants) {
        setExportProgress(
          `Preparing ${variant} image (${completed + 1} of ${variants.length})…`,
        );
        preparedImages.current.set(variant, await runExport(variant, saved));
        completed++;
      }
      const { blob, filename } = await packageSocialImages(
        listing.property_address ?? "property",
        preparedImages.current,
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
      const count = preparedImages.current.size;
      setExportProgress(
        count === 1
          ? "Image downloaded."
          : `${count} images downloaded in one ZIP.`,
      );
      preparedImages.current.clear();
      toast.success(
        count === 1 ? "Image downloaded" : "All formats downloaded",
      );
    } catch (error) {
      setRetryVariants(variants.slice(completed));
      const count = preparedImages.current.size;
      setExportProgress(
        count
          ? `${count} image${count === 1 ? "" : "s"} prepared. Retry to finish your download.`
          : "",
      );
      const message =
        error instanceof Error ? error.message : "Unable to download images";
      setExportError(message);
      toast.error(message);
    } finally {
      setExportingVariant(null);
      operation.current = false;
    }
  }

  const busy = saving || generating || exportingVariant != null;

  const activeFormat = SOCIAL_POST_FORMATS[activeVariantId];
  const editorSections = [
    {
      id: "photos",
      label: "Photos",
      icon: Image,
      title: "Choose your photos",
      hint: "Start with a great property photo. Your branding is already in place.",
    },
    {
      id: "wording",
      label: "Wording",
      icon: Type,
      title: "Make it your own",
      hint: "Keep it short. Your changes appear in the preview as you type.",
    },
    {
      id: "branding",
      label: "Branding",
      icon: BadgeCheck,
      title: "Add the finishing touches",
      hint: "Your agency branding, with an optional agent introduction.",
    },
  ] as const;
  const selectedSection = editorSections.find(
    (section) => section.id === editingSection,
  )!;

  return (
    <div data-theme="staypack-workspace" className="min-w-0 text-base-content">
      <UnsavedListingGuard
        dirty={dirty}
        description="Your social post has unsaved changes. Save your draft or download the post before leaving."
      />
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/social"
            aria-label="Back to social media"
            className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"
            inert={busy}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Social posts
            </h1>
            <p className="mt-1 truncate text-sm text-base-content/65">
              {listing.property_address ?? "Listing"}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
          <span
            role="status"
            className="flex items-center gap-1.5 text-xs text-base-content/65"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : dirty ? (
              <Circle className="size-2 fill-current" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            {saving
              ? "Saving…"
              : generating
                ? "Restoring design…"
                : exportingVariant
                  ? "Preparing download…"
                  : dirty
                    ? "Unsaved changes"
                    : "All changes saved"}
          </span>
          <button
            type="button"
            className="du-btn du-btn-sm du-btn-ghost min-h-11"
            onClick={handleSave}
            disabled={busy || !dirty}
          >
            <Save className="size-4" aria-hidden="true" /> Save draft
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="More post actions"
                  className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"
                  disabled={busy}
                >
                  <MoreHorizontal className="size-5" aria-hidden="true" />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  void exportVariants([...SOCIAL_POST_VARIANT_IDS])
                }
                disabled={busy}
              >
                <Download className="size-4" /> Download all 3 formats
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRegenerate} disabled={busy}>
                <RefreshCw className="size-4" /> Restore original designs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div inert={busy} className="mb-4">
        <PropertyContext
          listing={listing}
          editHref={`/social/${collateral.id}/property`}
        />
      </div>
      {exportProgress && (
        <p role="status" className="mb-4 text-sm text-base-content/65">
          {exportProgress}
        </p>
      )}
      {exportError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-error p-4 text-sm text-error-content"
        >
          <p>{exportError}</p>
          {retryVariants.length > 0 && (
            <button
              type="button"
              className="du-btn du-btn-sm min-h-11"
              disabled={busy}
              onClick={() => void exportVariants(retryVariants, true)}
            >
              Retry remaining downloads
            </button>
          )}
        </div>
      )}
      {saveError ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-error p-4 text-sm text-error-content"
        >
          <p>Draft not saved: {saveError}. Your edits are still here.</p>
          <button
            type="button"
            className="du-btn du-btn-sm min-h-11"
            disabled={busy}
            onClick={handleSave}
          >
            Try saving again
          </button>
        </div>
      ) : null}

      <fieldset
        disabled={busy}
        aria-busy={busy}
        className="min-w-0 rounded-2xl border border-base-300 bg-base-100 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <legend className="sr-only">Social post editor</legend>
        <section
          ref={previewRef}
          aria-label="Post preview"
          className="scroll-mt-20 min-w-0 self-start overflow-hidden rounded-t-2xl border-b border-base-300 lg:sticky lg:top-6 lg:rounded-l-2xl lg:rounded-tr-none lg:border-b-0"
        >
          <div className="flex items-center justify-between border-b border-base-300 px-4 py-2 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold">Your post</h2>
              <p className="text-xs text-base-content/60">
                Ready-made. Make it yours.
              </p>
            </div>
            <div className="flex gap-1" role="group" aria-label="Edit history">
              <button
                type="button"
                className="du-btn du-btn-sm du-btn-ghost min-h-11 lg:hidden"
                onClick={() =>
                  controlsRef.current?.scrollIntoView({ block: "start" })
                }
              >
                <Type className="size-4" aria-hidden="true" /> Edit
              </button>
              <button
                type="button"
                className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"
                aria-label="Undo last edit"
                title="Undo last edit"
                disabled={busy || !draft.past.length}
                onClick={() => {
                  clearPendingDownloads();
                  dispatch({ type: "undo" });
                }}
              >
                <Undo2 className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"
                aria-label="Redo edit"
                title="Redo edit"
                disabled={busy || !draft.future.length}
                onClick={() => {
                  clearPendingDownloads();
                  dispatch({ type: "redo" });
                }}
              >
                <Redo2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="h-[min(55dvh,30rem)] min-h-72 lg:h-[min(72dvh,48rem)] lg:min-h-[28rem]">
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
              measureFonts={{ headingFontFamily, bodyFontFamily }}
              onVariantChange={handleVariantChange}
            />
          </div>
        </section>

        <aside
          ref={controlsRef}
          aria-label="Customize post"
          className="scroll-mt-20 min-w-0 lg:border-l lg:border-base-300"
        >
          <div
            role="tablist"
            aria-label="Customize your post"
            className="grid grid-cols-3 border-b border-base-300 px-3 pt-2"
          >
            {editorSections.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`social-tab-${id}`}
                aria-controls={`social-panel-${id}`}
                aria-selected={editingSection === id}
                tabIndex={editingSection === id ? 0 : -1}
                onClick={() => setEditingSection(id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % 3
                      : event.key === "ArrowLeft"
                        ? (index + 2) % 3
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : null;
                  if (next == null) return;
                  event.preventDefault();
                  setEditingSection(editorSections[next].id);
                  window.document
                    .getElementById(`social-tab-${editorSections[next].id}`)
                    ?.focus();
                }}
                className={cn(
                  "flex min-h-14 items-center justify-center gap-2 border-b-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary",
                  editingSection === id
                    ? "border-primary text-primary"
                    : "border-transparent text-base-content/60 hover:text-base-content",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`social-panel-${editingSection}`}
            aria-labelledby={`social-tab-${editingSection}`}
            tabIndex={0}
            className="p-4 outline-offset-[-2px] sm:p-6"
          >
            <h2 className="text-lg font-semibold tracking-tight">
              {selectedSection.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-base-content/65">
              {selectedSection.hint}
            </p>
            <div className="my-5 flex flex-wrap items-center gap-2 text-xs text-base-content/65">
              <span className="du-badge du-badge-sm du-badge-outline">
                {activeFormat.label}
              </span>{" "}
              Photos & styling for this format
            </div>
            {editingSection !== "photos" ? (
              <p className="mb-4 text-xs leading-relaxed text-base-content/65">
                {editingSection === "wording"
                  ? "Text and property details update all 3 formats. Show/hide and layout choices apply only to this format."
                  : "Agent contact details update all 3 formats. Logo and appearance choices apply only to this format."}
              </p>
            ) : null}
            <SocialPostLayerPanel
              document={documentWithLiveBrand}
              listing={listing}
              backgroundOptions={backgroundOptions}
              onChange={changeDocument}
              section={editingSection}
            />
          </div>
        </aside>
      </fieldset>

      {!busy && (
        <div className="mt-6">
          <CreateAnother listingId={listing.id} />
        </div>
      )}

      <footer className="sticky bottom-0 z-20 -mx-1 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-base-300 bg-base-100 px-1 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        <div className="hidden sm:block">
          <p className="text-sm font-medium">Looking good?</p>
          <p className="text-xs text-base-content/65">
            Download saves your edits, too.
          </p>
        </div>
        <button
          type="button"
          className="du-btn du-btn-sm du-btn-ghost min-h-11 sm:hidden"
          onClick={() => previewRef.current?.scrollIntoView({ block: "start" })}
        >
          <Eye className="size-4" aria-hidden="true" /> Preview
        </button>
        <button
          type="button"
          className="du-btn du-btn-primary min-h-12 px-5"
          onClick={() => void exportVariants([activeVariantId])}
          disabled={busy}
        >
          {exportingVariant ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {exportingVariant ? "Preparing…" : "Download post"}
        </button>
      </footer>

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
