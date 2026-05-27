"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReportMediaPicker } from "@/components/reports/ReportMediaPicker";
import { MAX_REPORT_IMAGES } from "@/lib/reports/constants";
import { calculateAccommodates } from "@/lib/reports/formatters";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import type { Report } from "@/lib/types";

type Props = {
  report: Report;
  manualMode?: boolean;
  onSaved: (report: Report) => void;
};

export function ScrapedListingReviewStep({
  report,
  manualMode = false,
  onSaved,
}: Props) {
  const imported = !manualMode && Boolean(report.scraped_listing_json);
  const scrapedImages = report.scraped_listing_json?.images ?? [];

  const initialBedrooms = report.bedrooms ?? "";
  const [accommodatesTouched, setAccommodatesTouched] = useState(
    report.accommodates != null,
  );
  const [uploadedImages, setUploadedImages] = useState(
    report.uploaded_image_urls ?? [],
  );
  const [form, setForm] = useState({
    property_address: report.property_address ?? "",
    suburb: report.suburb ?? "",
    state: report.state ?? "",
    postcode: report.postcode ?? "",
    property_type: report.property_type ?? "",
    bedrooms: initialBedrooms,
    bathrooms: report.bathrooms ?? "",
    car_spaces: report.car_spaces ?? "",
    accommodates:
      report.accommodates ??
      (initialBedrooms === "" ? "" : calculateAccommodates(Number(initialBedrooms), null)),
    listing_title: report.listing_title ?? "",
    listing_description: report.listing_description ?? "",
    display_price: normalizeDisplayPrice(report.display_price) ?? "",
    hero_image_url: report.hero_image_url ?? scrapedImages[0] ?? "",
    selected_image_urls:
      report.selected_image_urls?.length
        ? report.selected_image_urls.slice(0, MAX_REPORT_IMAGES)
        : scrapedImages[0]
          ? [scrapedImages[0]]
          : [],
  });
  const [loading, setLoading] = useState(false);

  const scrapeWarnings = report.scraped_listing_json?.warnings ?? [];
  const scrapeConfidence = report.scraped_listing_json?.confidence;

  async function saveReport() {
    const selected = form.selected_image_urls.slice(0, MAX_REPORT_IMAGES);

    if (selected.length > MAX_REPORT_IMAGES) {
      toast.error(`Choose up to ${MAX_REPORT_IMAGES} images for the report`);
      return;
    }

    setLoading(true);

    const bedrooms = form.bedrooms === "" ? null : Number(form.bedrooms);
    const accommodates = calculateAccommodates(
      bedrooms,
      form.accommodates === "" ? null : Number(form.accommodates),
    );

    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        hero_image_url: form.hero_image_url || selected[0] || null,
        selected_image_urls: selected,
        uploaded_image_urls: uploadedImages,
        bedrooms,
        bathrooms: form.bathrooms === "" ? null : Number(form.bathrooms),
        car_spaces: form.car_spaces === "" ? null : Number(form.car_spaces),
        accommodates,
        status: "scraped",
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to save report");
      setLoading(false);
      return;
    }

    if (payload.geocode_warning) {
      toast.message("Listing saved, but geocoding needs review", {
        description: payload.geocode_warning,
      });
    } else if (payload.report.latitude != null && payload.report.longitude != null) {
      toast.success("Listing saved and address geocoded");
    } else {
      toast.success("Listing details saved");
    }

    onSaved(payload.report);
    setLoading(false);
  }

  function updateField(field: string, value: string | string[]) {
    if (field === "selected_image_urls" && Array.isArray(value)) {
      setForm((current) => ({
        ...current,
        selected_image_urls: value.slice(0, MAX_REPORT_IMAGES),
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
    <div className="space-y-6">
      {manualMode ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4">
          <p className="text-sm font-medium">Enter listing details manually</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Import didn&apos;t work for this URL. Fill in the property information
            below and upload up to {MAX_REPORT_IMAGES} photos for the report.
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
            Check the prefilled fields, then choose up to {MAX_REPORT_IMAGES} photos
            for the report. Upload your own images if the import missed any from the
            listing gallery.
          </p>
          {scrapedImages.length < MAX_REPORT_IMAGES ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Only {scrapedImages.length} photo
              {scrapedImages.length === 1 ? "" : "s"} imported from the listing —
              add more in the upload area below.
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
            <Label htmlFor={field}>{label}</Label>
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
        <Label htmlFor="listing_description">Description</Label>
        <Textarea
          id="listing_description"
          rows={5}
          value={form.listing_description}
          onChange={(event) =>
            updateField("listing_description", event.target.value)
          }
        />
      </div>

      <ReportMediaPicker
        scrapedImages={scrapedImages}
        uploadedImages={uploadedImages}
        heroImageUrl={form.hero_image_url}
        selectedImageUrls={form.selected_image_urls}
        reportId={report.id}
        maxSelected={MAX_REPORT_IMAGES}
        onUploaded={setUploadedImages}
        onChange={(hero, selected) => {
          updateField("hero_image_url", hero);
          updateField("selected_image_urls", selected);
        }}
      />

      <Button onClick={saveReport} disabled={loading || !report.id}>
        {loading ? "Saving..." : "Save and estimate STR"}
      </Button>
    </div>
  );
}
