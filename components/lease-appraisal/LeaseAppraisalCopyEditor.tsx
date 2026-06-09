"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Button } from "@/components/ui/button";
import {
  CopyEditorContextMetric,
  CopyEditorField,
  CopyEditorUnsavedBar,
} from "@/components/copy-editor/primitives";
import { BlurbVariantsEditor } from "@/components/collateral/sales-brochure/BlurbVariantsEditor";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { ReportImagePickerDialog } from "@/components/reports/inline/ReportImagePickerDialog";
import {
  getReportImageUrlAtSlot,
  pickReportPropertyImages,
  replaceReportImageAtSlot,
  type ReportImageSlot,
  type ReportPropertyImageSelection,
} from "@/lib/reports/editable/reportImageSlots";
import {
  setReportCopyValueAtPath,
  type ReportCopyFieldPath,
} from "@/lib/reports/editable/reportCopyPaths";
import { mergeLeaseAppraisalPreviewFromListing } from "@/lib/lease-appraisal/mergeLeaseAppraisalPreviewFromListing";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { hasLeaseAppraisalComps } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { hasLeaseAppraisalSelectedComps } from "@/lib/lease-appraisal/leaseAppraisalData";
import type { LeaseAppraisalCopy } from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import { isLeaseAppraisalTemplateId } from "@/lib/lease-appraisal/leaseAppraisalTemplates";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import { cn } from "@/lib/utils";
import type {
  Agency,
  CollateralItem,
  FinalReportJson,
  Listing,
  Report,
} from "@/lib/types";

type Props = {
  agency: Agency;
  listing: Listing;
  report: Report;
  collateral: CollateralItem;
  onListingChange: (listing: Listing) => void;
  onReportChange: (report: Report) => void;
  onCollateralChange: (collateral: CollateralItem) => void;
  onContinueToPreview?: () => void;
};

type ApiError = {
  error?: string;
};

export type LeaseAppraisalCopyEditorHandle = {
  flushPendingEdits: () => void;
  getPreviewReport: () => FinalReportJson | null;
};

function copyFromReport(report: Report): LeaseAppraisalCopy | null {
  const json = report.final_report_json as FinalReportJson | null;
  if (!json?.copy) {
    return null;
  }
  return json.copy as LeaseAppraisalCopy;
}

function editorSnapshot(
  copy: LeaseAppraisalCopy,
  propertyImages: ReportPropertyImageSelection | null,
) {
  return JSON.stringify({ copy, propertyImages });
}

function propertyImagesFromReport(report: Report | null): ReportPropertyImageSelection | null {
  const json = report?.final_report_json as FinalReportJson | null;
  if (!json?.property) {
    return null;
  }
  return pickReportPropertyImages(json.property);
}

export const LeaseAppraisalCopyEditor = forwardRef<
  LeaseAppraisalCopyEditorHandle,
  Props
>(function LeaseAppraisalCopyEditor(
  {
    listing,
    report,
    collateral,
    onListingChange,
    onReportChange,
    onCollateralChange,
    onContinueToPreview,
  },
  ref,
) {
  const templateId = isLeaseAppraisalTemplateId(report.template_id)
    ? report.template_id!
    : collateral.template_id;

  const [copy, setCopy] = useState<LeaseAppraisalCopy | null>(() =>
    copyFromReport(report),
  );
  const copyRef = useRef(copy);
  const [propertyImages, setPropertyImages] = useState<ReportPropertyImageSelection | null>(
    () => propertyImagesFromReport(report),
  );
  const propertyImagesRef = useRef(propertyImages);
  const [imagePickerSlot, setImagePickerSlot] = useState<ReportImageSlot | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(() =>
    copy ? editorSnapshot(copy, propertyImagesFromReport(report)) : null,
  );

  useEffect(() => {
    const next = copyFromReport(report);
    const nextImages = propertyImagesFromReport(report);
    copyRef.current = next;
    propertyImagesRef.current = nextImages;
    setCopy(next);
    setPropertyImages(nextImages);
    setLastSavedSnapshot(
      next ? editorSnapshot(next, nextImages) : null,
    );
  }, [report.final_report_json, report.updated_at]);

  const displayPrice = useMemo(() => resolveReportDisplayPrice(listing), [listing]);
  const parsed = listing.scraped_listing_json;
  const appraisal = parsed?.rentalAppraisal;

  const rentRangeLabel = useMemo(() => {
    if (appraisal?.weeklyMin != null && appraisal?.weeklyMax != null) {
      return formatWeeklyRentRange(appraisal.weeklyMin, appraisal.weeklyMax);
    }
    if (appraisal?.weeklyMidpoint != null) {
      return formatWeeklyRentRange(
        appraisal.weeklyMidpoint,
        appraisal.weeklyMidpoint,
      );
    }
    return null;
  }, [appraisal]);

  const currentSnapshot = copy
    ? editorSnapshot(copy, propertyImages)
    : null;
  const isDirty =
    currentSnapshot != null &&
    lastSavedSnapshot != null &&
    currentSnapshot !== lastSavedSnapshot;

  const previewReport = useMemo(() => {
    const cached = report.final_report_json as FinalReportJson | null;
    if (!cached || !copy) {
      return null;
    }
    const withListing = mergeLeaseAppraisalPreviewFromListing(
      {
        ...cached,
        copy,
        template_id: templateId ?? cached.template_id,
      },
      listing,
    );
    const withImages = propertyImages
      ? {
          ...withListing,
          property: {
            ...withListing.property,
            ...propertyImages,
          },
        }
      : withListing;
    return resolveFinalReportForDisplay(withImages);
  }, [report.final_report_json, copy, templateId, listing, propertyImages]);

  const handleOpenImagePicker = useCallback((slot: ReportImageSlot) => {
    setImagePickerSlot(slot);
  }, []);

  const handleImageSelect = useCallback(
    (url: string) => {
      if (!previewReport || !imagePickerSlot) {
        return;
      }
      const next = replaceReportImageAtSlot(previewReport, imagePickerSlot, url);
      const images = pickReportPropertyImages(next.property);
      propertyImagesRef.current = images;
      setPropertyImages(images);
      setImagePickerSlot(null);
    },
    [imagePickerSlot, previewReport],
  );

  const commitCopy = useCallback(
    (updater: (current: LeaseAppraisalCopy) => LeaseAppraisalCopy) => {
      setCopy((current) => {
        if (!current) {
          return current;
        }
        const next = updater(current);
        copyRef.current = next;
        return next;
      });
    },
    [],
  );

  const flushPendingEdits = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flushPendingEdits,
      getPreviewReport: () => previewReport,
    }),
    [flushPendingEdits, previewReport],
  );

  async function persistCopy(options?: { silent?: boolean }) {
    flushPendingEdits();
    const copyToSave = copyRef.current;
    const imagesToSave = propertyImagesRef.current;
    if (!copyToSave || !templateId) {
      return true;
    }

    setSaving(true);
    setSaveFailed(false);
    const response = await fetch(`/api/reports/${report.id}/lease-appraisal-copy`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        copy: copyToSave,
        template_id: templateId,
        property_images: imagesToSave ?? undefined,
      }),
    });
    const payload = (await response.json()) as ApiError & {
      report?: Report;
      listing?: Listing;
    };

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to save appraisal");
      setSaveFailed(true);
      setSaving(false);
      return false;
    }

    if (payload.report) {
      onReportChange(payload.report);
    }
    if (payload.listing) {
      onListingChange(payload.listing);
    }

    setLastSavedSnapshot(editorSnapshot(copyToSave, imagesToSave));
    if (!options?.silent) {
      toast.success("Collateral saved");
    }
    setSaving(false);
    return true;
  }

  async function generateContent() {
    if (copy && !confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }

    setConfirmRegenerate(false);

    if (!templateId) {
      toast.error("Choose a template first");
      return;
    }

    if (!hasLeaseAppraisalComps(parsed) || !hasLeaseAppraisalSelectedComps(parsed)) {
      toast.error("Complete appraisal data before generating collateral");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(
        `/api/reports/${report.id}/generate-lease-appraisal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: templateId }),
        },
      );
      const payload = (await response.json()) as ApiError & {
        report?: Report;
        listing?: Listing;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate collateral");
      }

      if (payload.report) {
        onReportChange(payload.report);
        const nextCopy = copyFromReport(payload.report);
        copyRef.current = nextCopy;
        setCopy(nextCopy);
        if (nextCopy) {
          const nextImages = propertyImagesFromReport(payload.report);
          propertyImagesRef.current = nextImages;
          setPropertyImages(nextImages);
          setLastSavedSnapshot(editorSnapshot(nextCopy, nextImages));
        }
      }

      if (payload.listing) {
        onListingChange(payload.listing);
      }

      onCollateralChange({
        ...collateral,
        status: "generated",
        template_id: templateId,
      });

      toast.success("Collateral generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to generate collateral",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function continueToPreview() {
    if (copy) {
      const saved = await persistCopy({ silent: true });
      if (!saved) {
        return;
      }
    }
    onContinueToPreview?.();
  }

  function updateField<K extends keyof LeaseAppraisalCopy>(
    field: K,
    value: LeaseAppraisalCopy[K],
  ) {
    commitCopy((current) => ({ ...current, [field]: value }));
  }

  const handleInlineSetField = useCallback(
    (path: ReportCopyFieldPath, value: string) => {
      commitCopy((current) =>
        setReportCopyValueAtPath(current, path, value) as LeaseAppraisalCopy,
      );
    },
    [commitCopy],
  );

  const addressLine = [
    listing.property_address,
    listing.suburb,
    listing.state,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  const selectedCount = appraisal?.selectedCompListingIds?.length ?? 0;
  const contextSummary = leaseListingContextSummary(
    listing,
    displayPrice,
    rentRangeLabel,
    selectedCount,
  );
  const compsReady =
    hasLeaseAppraisalComps(parsed) && hasLeaseAppraisalSelectedComps(parsed);

  return (
    <AsyncLoadingOverlay
      active={generating}
      title="Generating collateral"
      description="Writing investor-facing lease appraisal copy from your listing and rent comps. This usually takes 15–30 seconds."
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl flex-col gap-4",
          copy && isDirty && "pb-24",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              {copy && isDirty ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                  aria-hidden
                />
              ) : null}
              {copy ? "Edit lease appraisal" : "Content generation"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy
                ? "Hover photos on the preview and click Change photo to pick another image or floor plan. Click text to edit copy inline."
                : "Generate investor-facing copy from your listing and rent comps, then edit directly on the appraisal."}
            </p>
            {addressLine ? (
              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {addressLine}
              </p>
            ) : null}
            {copy && contextSummary ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{contextSummary}</p>
            ) : null}
            {saveFailed ? (
              <p className="mt-1 text-xs text-destructive">Save failed — try again below.</p>
            ) : null}
            {!compsReady && !copy ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Complete the Appraisal data step before generating collateral.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {copy && isDirty ? (
              <Button
                disabled={generating || saving}
                onClick={() => void persistCopy()}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            ) : null}
            <Button
              onClick={generateContent}
              disabled={generating || saving || !compsReady}
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generating…
                </>
              ) : copy && confirmRegenerate ? (
                "Confirm regenerate"
              ) : copy ? (
                "Regenerate copy"
              ) : (
                "Generate collateral"
              )}
            </Button>
            {copy ? (
              <Button
                variant="outline"
                onClick={continueToPreview}
                disabled={generating || saving || isDirty}
                title={
                  isDirty
                    ? "Save your changes before continuing to preview"
                    : undefined
                }
              >
                Continue to preview
              </Button>
            ) : null}
          </div>
        </div>

        {!copy ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-6 text-sm">
            <p className="font-medium">Listing context</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <CopyEditorContextMetric
                label="Bedrooms"
                value={listing.bedrooms != null ? String(listing.bedrooms) : "—"}
              />
              <CopyEditorContextMetric
                label="Bathrooms"
                value={listing.bathrooms != null ? String(listing.bathrooms) : "—"}
              />
              <CopyEditorContextMetric
                label="Listing price"
                value={displayPrice ?? "—"}
              />
              <CopyEditorContextMetric
                label="Rent guide"
                value={rentRangeLabel ?? "—"}
              />
              <CopyEditorContextMetric
                label="Featured comps"
                value={selectedCount > 0 ? String(selectedCount) : "—"}
              />
            </div>
          </div>
        ) : null}

        {previewReport && copy ? (
          <>
            <FittedReportPreview
              report={previewReport}
              maxHeight="min(85vh, 960px)"
              fitToWidth
              editable={{
                setField: handleInlineSetField,
                openImagePicker: handleOpenImagePicker,
                brandPrimaryColour: previewReport.agency.primary_colour,
              }}
            />

            <ReportImagePickerDialog
              open={imagePickerSlot != null}
              onOpenChange={(open) => {
                if (!open) {
                  setImagePickerSlot(null);
                }
              }}
              listing={listing}
              slot={imagePickerSlot}
              currentUrl={
                previewReport && imagePickerSlot
                  ? getReportImageUrlAtSlot(previewReport.property, imagePickerSlot)
                  : undefined
              }
              onSelect={handleImageSelect}
            />

            <details className="group rounded-xl border border-border/70 bg-muted/10">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span>More options</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Headings, highlights, comparable evidence, legal
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border/70 px-4 py-4">
                <CopyEditorField
                  label="Heading"
                  value={copy.heading}
                  onChange={(value) => updateField("heading", value)}
                />
                <BlurbVariantsEditor
                  copy={{
                    heading: copy.heading,
                    blurb: copy.blurb,
                    blurb_variants: copy.blurb_variants,
                    property_highlights: copy.appeal_points,
                    inspection_cta: copy.cta,
                    disclaimer: copy.disclaimer,
                  }}
                  onChange={(shaped) =>
                    commitCopy((current) => ({
                      ...current,
                      blurb: shaped.blurb,
                      blurb_variants: shaped.blurb_variants,
                    }))
                  }
                />
                <CopyEditorField
                  label="Key points"
                  value={copy.appeal_points.join("\n")}
                  onChange={(value) =>
                    updateField(
                      "appeal_points",
                      value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    )
                  }
                  textarea
                  hint="One point per line."
                />
                <CopyEditorField
                  label="Supporting factors"
                  value={copy.supporting_factors.join("\n")}
                  onChange={(value) =>
                    updateField(
                      "supporting_factors",
                      value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    )
                  }
                  textarea
                  hint="One factor per line."
                />
                <CopyEditorField
                  label="Comparable evidence (page 2)"
                  value={copy.comparable_evidence}
                  onChange={(value) => updateField("comparable_evidence", value)}
                  textarea
                />
                <CopyEditorField
                  label="Comparable disclaimer"
                  value={copy.comparable_disclaimer}
                  onChange={(value) => updateField("comparable_disclaimer", value)}
                  textarea
                />
                <CopyEditorField
                  label="Methodology note"
                  value={copy.methodology_note}
                  onChange={(value) => updateField("methodology_note", value)}
                  textarea
                />
                <CopyEditorField
                  label="Disclaimer"
                  value={copy.disclaimer}
                  onChange={(value) => updateField("disclaimer", value)}
                  textarea
                />
                <CopyEditorField
                  label="Call to action"
                  value={copy.cta}
                  onChange={(value) => updateField("cta", value)}
                />
              </div>
            </details>
          </>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            {compsReady
              ? "Generate collateral to preview and edit your lease appraisal here."
              : "Complete appraisal data, then generate collateral to preview and edit here."}
          </div>
        )}
      </div>

      {copy && isDirty ? (
        <CopyEditorUnsavedBar
          saving={saving}
          generating={generating}
          saveLabel="Save appraisal"
          description="Save your appraisal before continuing to preview."
          onSave={() => void persistCopy()}
        />
      ) : null}
    </AsyncLoadingOverlay>
  );
});

function leaseListingContextSummary(
  listing: Listing,
  displayPrice: string | null | undefined,
  rentRangeLabel: string | null,
  selectedCompCount: number,
) {
  const parts: string[] = [];
  if (listing.bedrooms != null) {
    parts.push(`${listing.bedrooms} bed`);
  }
  if (listing.bathrooms != null) {
    parts.push(`${listing.bathrooms} bath`);
  }
  const price = displayPrice ?? listing.display_price;
  if (price) {
    parts.push(`Listing price: ${price}`);
  }
  if (rentRangeLabel) {
    parts.push(`Rent guide: ${rentRangeLabel}`);
  }
  if (selectedCompCount > 0) {
    parts.push(`${selectedCompCount} featured comps`);
  }
  return parts.length ? parts.join(" · ") : null;
}
