"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportMediaPicker } from "@/components/reports/ReportMediaPicker";
import {
  buildDefaultMasterSelection,
  getDedupedScrapedImages,
  getListingImagePool,
  getMasterSelectionLimit,
  normalizeSelectionToPool,
} from "@/lib/listings/collateralImages";
import { resolveListingImageMetaForPool } from "@/lib/listings/syncListingImageMeta";
import type { Listing, ListingImageMetaMap } from "@/lib/types";

type Props = {
  listing: Listing;
  onUpdated: (listing: Listing) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function CollateralImageEditor({
  listing,
  onUpdated,
  onDirtyChange,
}: Props) {
  const [uploadedImages, setUploadedImages] = useState(
    listing.uploaded_image_urls ?? [],
  );
  const [heroImageUrl, setHeroImageUrl] = useState(
    listing.hero_image_url ?? "",
  );
  const [selectedImageUrls, setSelectedImageUrls] = useState(
    listing.selected_image_urls ?? [],
  );
  const [listingImageMeta, setListingImageMeta] = useState<ListingImageMetaMap>(
    () => resolveListingImageMetaForPool(listing),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const imagePool = useMemo(
    () =>
      getListingImagePool({ ...listing, uploaded_image_urls: uploadedImages }),
    [listing, uploadedImages],
  );
  const scrapedImages = useMemo(
    () => getDedupedScrapedImages(listing),
    [listing],
  );
  const rawScrapedCount = listing.scraped_listing_json?.images?.length ?? 0;
  const maxSelected = getMasterSelectionLimit({
    ...listing,
    uploaded_image_urls: uploadedImages,
  });

  const currentSelection = useMemo(
    () =>
      normalizeSelectionToPool(
        {
          hero_image_url: heroImageUrl || null,
          selected_image_urls: selectedImageUrls,
        },
        imagePool,
      ),
    [heroImageUrl, selectedImageUrls, imagePool],
  );

  const defaultSelection = useMemo(
    () =>
      buildDefaultMasterSelection({
        ...listing,
        uploaded_image_urls: uploadedImages,
      }),
    [listing, uploadedImages],
  );

  const isCustomized =
    currentSelection.selected_image_urls.join("|") !==
    defaultSelection.selected_image_urls.join("|");

  const savedSelection = normalizeSelectionToPool(
    {
      hero_image_url: listing.hero_image_url,
      selected_image_urls: listing.selected_image_urls ?? [],
    },
    imagePool,
  );
  const dirty =
    JSON.stringify(currentSelection) !== JSON.stringify(savedSelection) ||
    JSON.stringify(listingImageMeta) !==
      JSON.stringify(resolveListingImageMetaForPool(listing));
  useEffect(() => {
    onDirtyChange?.(dirty || saving || uploading);
    return () => onDirtyChange?.(false);
  }, [dirty, saving, uploading, onDirtyChange]);
  function discard() {
    setHeroImageUrl(listing.hero_image_url ?? "");
    setSelectedImageUrls(listing.selected_image_urls ?? []);
    setListingImageMeta(resolveListingImageMetaForPool(listing));
  }

  function updateSelection(hero: string, selected: string[]) {
    setHeroImageUrl(hero);
    setSelectedImageUrls(selected);
  }

  async function saveSelection(body: {
    hero_image_url: string | null;
    selected_image_urls: string[];
    listing_image_meta?: ListingImageMetaMap;
  }) {
    setSaving(true);

    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hero_image_url: body.hero_image_url,
          selected_image_urls: body.selected_image_urls,
          uploaded_image_urls: uploadedImages,
          ...(body.listing_image_meta !== undefined
            ? { listing_image_meta: body.listing_image_meta }
            : {}),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save photos");
      }

      const saved = payload.listing as Listing;
      setHeroImageUrl(saved.hero_image_url ?? "");
      setSelectedImageUrls(saved.selected_image_urls ?? []);
      setListingImageMeta(resolveListingImageMetaForPool(saved));
      onUpdated(saved);
      toast.success("Photos saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save photos",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!currentSelection.selected_image_urls.length) {
      toast.error("Select at least one property photo before saving.");
      return;
    }
    const selectionToSave = currentSelection;

    setHeroImageUrl(selectionToSave.hero_image_url ?? "");
    setSelectedImageUrls(selectionToSave.selected_image_urls);

    await saveSelection({
      hero_image_url: selectionToSave.hero_image_url,
      selected_image_urls: selectionToSave.selected_image_urls,
      listing_image_meta: listingImageMeta,
    });
  }

  function resetToAll() {
    setHeroImageUrl(defaultSelection.hero_image_url ?? "");
    setSelectedImageUrls(defaultSelection.selected_image_urls);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Property photos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the photos available to new collateral and set a cover photo.
          Published collateral keeps its saved photos.
        </p>
      </div>

      {rawScrapedCount > scrapedImages.length && (
        <p className="text-xs text-muted-foreground">
          Duplicate images and video thumbnails are excluded from collateral
          photos.
        </p>
      )}
      <ReportMediaPicker
        title=""
        scrapedImages={scrapedImages}
        rawScrapedCount={rawScrapedCount}
        uploadedImages={uploadedImages}
        heroImageUrl={currentSelection.hero_image_url ?? ""}
        selectedImageUrls={currentSelection.selected_image_urls}
        listingId={listing.id}
        maxSelected={maxSelected}
        onUploaded={setUploadedImages}
        onBusyChange={setUploading}
        onChange={updateSelection}
        listingImageMeta={listingImageMeta}
        onListingImageMetaChange={setListingImageMeta}
      />

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-4 shadow-sm">
        <p role="status" className="mr-auto text-sm text-muted-foreground">
          {saving
            ? "Saving…"
            : dirty
              ? "Unsaved photo changes"
              : "All changes saved"}
        </p>
        <Button
          variant="ghost"
          disabled={!dirty || saving || uploading}
          onClick={discard}
        >
          Discard
        </Button>
        <Button onClick={handleSave} disabled={saving || uploading || !dirty}>
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving...
            </>
          ) : (
            "Save photos"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={resetToAll}
          disabled={saving || uploading}
        >
          Select all
        </Button>
        {isCustomized ? (
          <span className="self-center text-xs text-muted-foreground">
            {currentSelection.selected_image_urls.length} selected
          </span>
        ) : (
          <span className="self-center text-xs text-muted-foreground">
            All {currentSelection.selected_image_urls.length} photos selected
          </span>
        )}
      </div>
    </div>
  );
}
