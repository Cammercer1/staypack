"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReportMediaPicker } from "@/components/reports/ReportMediaPicker";
import { MAX_LANDING_IMAGES } from "@/lib/listings/collateralImageLimits";
import {
  resolveMasterPhotoSelection,
} from "@/lib/listings/collateralImages";
import {
  initialListingAgents,
  listingAgentsToParsed,
} from "@/lib/reports/listingAgents";
import { calculateAccommodates } from "@/lib/reports/formatters";
import { isPersistedListing } from "@/lib/listings/emptyListingDraft";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import type { Listing, Report } from "@/lib/types";

type Props = {
  listing: Listing;
  report?: Report | null;
  manualMode?: boolean;
  listingSetup?: boolean;
  onSaved: (state: { listing: Listing; report?: Report | null }) => void;
};

export function ScrapedListingReviewStep({
  listing,
  report = null,
  manualMode = false,
  listingSetup = false,
  onSaved,
}: Props) {
  const imported = !manualMode && Boolean(listing.scraped_listing_json);
  const scrapedImages = listing.scraped_listing_json?.images ?? [];
  const masterSelection = resolveMasterPhotoSelection(listing);

  const initialBedrooms = listing.bedrooms ?? "";
  const [accommodatesTouched, setAccommodatesTouched] = useState(
    listing.accommodates != null,
  );
  const [uploadedImages, setUploadedImages] = useState(
    listing.uploaded_image_urls ?? [],
  );
  const [form, setForm] = useState({
    listing_purpose: listing.listing_purpose ?? "sale",
    property_address: listing.property_address ?? "",
    suburb: listing.suburb ?? "",
    state: listing.state ?? "",
    postcode: listing.postcode ?? "",
    property_type: listing.property_type ?? "",
    bedrooms: initialBedrooms,
    bathrooms: listing.bathrooms ?? "",
    car_spaces: listing.car_spaces ?? "",
    accommodates:
      listing.accommodates ??
      (initialBedrooms === "" ? "" : calculateAccommodates(Number(initialBedrooms), null)),
    listing_title: listing.listing_title ?? "",
    listing_description: listing.listing_description ?? "",
    display_price: normalizeDisplayPrice(listing.display_price) ?? "",
    hero_image_url:
      masterSelection.hero_image_url ?? scrapedImages[0] ?? "",
    selected_image_urls: masterSelection.selected_image_urls.length
      ? masterSelection.selected_image_urls.slice(0, MAX_LANDING_IMAGES)
      : scrapedImages[0]
        ? [scrapedImages[0]]
        : [],
  });
  const [loading, setLoading] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  async function generateDescription() {
    if (!isPersistedListing(listing)) return;
    setGeneratingDesc(true);

    try {
      const response = await fetch(
        `/api/listings/${listing.id}/generate-description`,
        { method: "POST" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate description");
      }

      updateField("listing_description", payload.description as string);
      toast.success("Description generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to generate description",
      );
    } finally {
      setGeneratingDesc(false);
    }
  }

  const scrapeWarnings = listing.scraped_listing_json?.warnings ?? [];
  const scrapeConfidence = listing.scraped_listing_json?.confidence;

  async function saveListing() {
    const selected = form.selected_image_urls.slice(0, MAX_LANDING_IMAGES);

    if (selected.length > MAX_LANDING_IMAGES) {
      toast.error(`Choose up to ${MAX_LANDING_IMAGES} photos`);
      return;
    }

    setLoading(true);

    const bedrooms = form.bedrooms === "" ? null : Number(form.bedrooms);
    const accommodates = calculateAccommodates(
      bedrooms,
      form.accommodates === "" ? null : Number(form.accommodates),
    );

    const payloadBody = {
      ...form,
      ...(listingSetup
        ? {}
        : {
            listing_agents: listingAgentsToParsed(
              initialListingAgents(listing.scraped_listing_json?.agents),
            ),
            hero_image_url: form.hero_image_url || selected[0] || null,
            selected_image_urls: selected.slice(0, MAX_LANDING_IMAGES),
            uploaded_image_urls: uploadedImages,
          }),
      bedrooms,
      bathrooms: form.bathrooms === "" ? null : Number(form.bathrooms),
      car_spaces: form.car_spaces === "" ? null : Number(form.car_spaces),
      accommodates,
    };

    const listingResponse = await fetch(
      isPersistedListing(listing) ? `/api/listings/${listing.id}` : "/api/listings",
      {
        method: isPersistedListing(listing) ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      },
    );
    const listingPayload = await listingResponse.json();

    if (!listingResponse.ok) {
      toast.error(listingPayload.error ?? "Failed to save listing");
      setLoading(false);
      return;
    }

    const nextListing = listingPayload.listing as Listing;

    if (!listingSetup && report) {
      const reportResponse = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scraped" }),
      });
      const reportPayload = await reportResponse.json();

      if (!reportResponse.ok) {
        toast.error(reportPayload.error ?? "Failed to update report");
        setLoading(false);
        return;
      }

      onSaved({ listing: nextListing, report: reportPayload.report as Report });
    } else {
      onSaved({ listing: nextListing, report: report ?? null });
    }
    if (listingPayload.geocode_warning) {
      toast.message("Listing saved, but geocoding needs review", {
        description: listingPayload.geocode_warning,
      });
    } else if (nextListing.latitude != null && nextListing.longitude != null) {
      toast.success("Listing saved and address geocoded");
    } else {
      toast.success("Listing saved");
    }

    setLoading(false);
  }

  function updateField(field: string, value: string | string[]) {
    if (field === "selected_image_urls" && Array.isArray(value)) {
      setForm((current) => ({
        ...current,
        selected_image_urls: value.slice(0, MAX_LANDING_IMAGES),
      }));
      return;
    }

    if (field === "accommodates") {
      setAccommodatesTouched(true);
    }

    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "bedrooms" && !accommodatesTouched) {
        const bedrooms = value === "" ? null : Number(value);
        next.accommodates = bedrooms
          ? calculateAccommodates(bedrooms, null)
          : "";
      }

      return next;
    });
  }

  return (
    <AsyncLoadingOverlay
      active={loading}
      title="Saving listing"
      description="Saving details and geocoding the address for the STR estimate."
    >
    <div className="space-y-6">
      {manualMode ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4">
          <p className="text-sm font-medium">Enter listing details manually</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Import didn&apos;t work for this URL. Fill in the property information
            below and upload photos.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-medium">
            {scrapeConfidence
              ? `Imported listing · confidence: ${scrapeConfidence}`
              : "Review imported listing details"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check the prefilled fields, review the webpage description, and choose
            which photos to keep. All are selected by default.
          </p>
          {scrapedImages.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {scrapedImages.length} photo
              {scrapedImages.length === 1 ? "" : "s"} imported from the listing
              {scrapedImages.length < MAX_LANDING_IMAGES
                ? " — add more in the upload area below."
                : "."}
            </p>
          ) : null}
          {scrapeWarnings.length ? (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {scrapeWarnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="space-y-2">
        <Label>This listing is for</Label>
        <div className="inline-flex rounded-lg border border-border/70 p-1">
          {(["sale", "lease"] as const).map((purpose) => (
            <Button
              key={purpose}
              type="button"
              size="sm"
              variant={form.listing_purpose === purpose ? "default" : "ghost"}
              onClick={() => updateField("listing_purpose", purpose)}
            >
              {purpose === "sale" ? "Sale" : "Lease"}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Lease listings skip the short-term rental report.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["property_address", "Address"],
          ["suburb", "Suburb"],
          ["state", "State"],
          ["postcode", "Postcode"],
          ["property_type", "Property type"],
          ["bedrooms", "Bedrooms"],
          ["bathrooms", "Bathrooms"],
          ["car_spaces", "Car spaces"],
          ["accommodates", "Accommodates"],
          ["display_price", "Display price"],
          ["listing_title", "Title"],
        ].map(([field, label]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={field}>
              {field === "display_price"
                ? form.listing_purpose === "lease"
                  ? "Rent (per week)"
                  : "Sale price"
                : label}
            </Label>
            <Input
              id={field}
              value={String(form[field as keyof typeof form] ?? "")}
              onChange={(event) => updateField(field, event.target.value)}
            />
            {field === "accommodates" ? (
              <p className="text-xs text-muted-foreground">
                Defaults to 2 guests per bedroom. Override if needed for the STR estimate.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="listing_description">Description</Label>
          {isPersistedListing(listing) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateDescription}
              disabled={generatingDesc}
            >
              {generatingDesc ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Generate with AI
            </Button>
          ) : null}
        </div>
        <Textarea
          id="listing_description"
          rows={6}
          value={form.listing_description}
          onChange={(event) =>
            updateField("listing_description", event.target.value)
          }
        />
      </div>

      {!listingSetup ? (
        <ReportMediaPicker
          scrapedImages={scrapedImages}
          uploadedImages={uploadedImages}
          heroImageUrl={form.hero_image_url}
          selectedImageUrls={form.selected_image_urls}
          listingId={isPersistedListing(listing) ? listing.id : undefined}
          reportId={report?.id}
          maxSelected={MAX_LANDING_IMAGES}
          title="Property photos"
          onUploaded={setUploadedImages}
          onChange={(hero, selected) => {
            updateField("hero_image_url", hero);
            updateField("selected_image_urls", selected);
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Manage photos in the <strong>Photos</strong> tab on the listing page.
        </p>
      )}

      <Button
        onClick={saveListing}
        disabled={loading || !form.property_address.trim()}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Saving...
          </>
        ) : listingSetup ? (
          "Save listing"
        ) : (
          "Save listing details"
        )}
      </Button>
    </div>
    </AsyncLoadingOverlay>
  );
}
