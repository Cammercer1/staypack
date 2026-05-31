"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportMediaPicker } from "@/components/reports/ReportMediaPicker";
import {
  buildDefaultMasterSelection,
  getDedupedScrapedImages,
  getListingImagePool,
  getMasterSelectionLimit,
  mergeNewPhotosIntoSelection,
  normalizeSelectionToPool,
} from "@/lib/listings/collateralImages";
import { resolveListingImageMetaForPool } from "@/lib/listings/syncListingImageMeta";
import type { Listing, ListingImageMetaMap } from "@/lib/types";

type Props = {
  listing: Listing;
  onUpdated: (listing: Listing) => void;
};

export function CollateralImageEditor({ listing, onUpdated }: Props) {
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

  const imagePool = useMemo(
    () => getListingImagePool({ ...listing, uploaded_image_urls: uploadedImages }),
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
        { hero_image_url: heroImageUrl || null, selected_image_urls: selectedImageUrls },
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
      toast.error(error instanceof Error ? error.message : "Unable to save photos");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const selectionToSave = mergeNewPhotosIntoSelection(
      {
        hero_image_url: currentSelection.hero_image_url,
        selected_image_urls: currentSelection.selected_image_urls,
      },
      imagePool,
    );

    setHeroImageUrl(selectionToSave.hero_image_url ?? "");
    setSelectedImageUrls(selectionToSave.selected_image_urls);

    await saveSelection({
      hero_image_url: selectionToSave.hero_image_url,
      selected_image_urls: selectionToSave.selected_image_urls,
      listing_image_meta: listingImageMeta,
    });
  }

  async function resetToAll() {
    await saveSelection(defaultSelection);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Property photos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All photos are selected by default. Mark floor plans so brochures fit
          them inside any image slot without cropping.
        </p>
      </div>

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
        onChange={updateSelection}
        listingImageMeta={listingImageMeta}
        onListingImageMetaChange={setListingImageMeta}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
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
          disabled={saving}
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
