"use client";

import { resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import {
  CopyEditorContextMetric,
  CopyEditorField,
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
import { mergeAppraisalPreviewAgents } from "@/lib/reports/mergeAppraisalPreviewAgents";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { hasLeaseAppraisalComps } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { hasLeaseAppraisalSelectedComps } from "@/lib/lease-appraisal/leaseAppraisalData";
import type { LeaseAppraisalCopy } from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import { isLeaseAppraisalTemplateId } from "@/lib/lease-appraisal/leaseAppraisalTemplates";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import { resolveAdvertisedPrice } from "@/lib/listings/pricing";
import { AppraisalStepHeader } from "@/components/appraisals/AppraisalStepHeader";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  FinalReportJson,
  Listing,
  Report,
} from "@/lib/types";

type Props = {
  onBusyChange?: (busy: boolean) => void;
  agency: Agency;
  agencyAgents: AgentProfile[];
  listing: Listing;
  report: Report;
  collateral: CollateralItem;
  onListingChange: (listing: Listing) => void;
  onReportChange: (report: Report) => void;
  onCollateralChange: (collateral: CollateralItem) => void;
  onContinueToPreview?: () => void;
  needsRebuild?: boolean;
};

type ApiError = {
  error?: string;
};

export type LeaseAppraisalCopyEditorHandle = {
  flushPendingEdits: () => void;
  getPreviewReport: () => FinalReportJson | null;
  savePendingEdits: () => Promise<boolean>;
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

function propertyImagesFromReport(
  report: Report | null,
): ReportPropertyImageSelection | null {
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
    agencyAgents,
    listing,
    report,
    collateral,
    onListingChange,
    onReportChange,
    onCollateralChange,
    onContinueToPreview,
    needsRebuild = false,
    onBusyChange,
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
  const blurbBaselineRef = useRef<string | null>(null);
  const blurbFlushRef = useRef<(() => string | null) | null>(null);
  const [propertyImages, setPropertyImages] =
    useState<ReportPropertyImageSelection | null>(() =>
      propertyImagesFromReport(report),
    );
  const propertyImagesRef = useRef(propertyImages);
  const [imagePickerSlot, setImagePickerSlot] =
    useState<ReportImageSlot | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(
    () =>
      copy ? editorSnapshot(copy, propertyImagesFromReport(report)) : null,
  );

  useEffect(() => {
    const next = copyFromReport(report);
    const nextImages = propertyImagesFromReport(report);
    copyRef.current = next;
    propertyImagesRef.current = nextImages;
    setCopy(next);
    setPropertyImages(nextImages);
    setLastSavedSnapshot(next ? editorSnapshot(next, nextImages) : null);
  }, [report.final_report_json, report.updated_at]);

  const displayPrice = useMemo(
    () => resolveAdvertisedPrice(listing, "lease"),
    [listing],
  );
  const parsed = useMemo(() => resolveAppraisalInput(listing), [listing]);
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

  const currentSnapshot = copy ? editorSnapshot(copy, propertyImages) : null;
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
    return resolveFinalReportForDisplay(
      mergeAppraisalPreviewAgents(withImages, listing, agencyAgents),
    );
  }, [
    report.final_report_json,
    copy,
    templateId,
    listing,
    propertyImages,
    agencyAgents,
  ]);

  const handleOpenImagePicker = useCallback((slot: ReportImageSlot) => {
    setImagePickerSlot(slot);
  }, []);

  const handleImageSelect = useCallback(
    (url: string) => {
      if (!previewReport || !imagePickerSlot) {
        return;
      }
      const next = replaceReportImageAtSlot(
        previewReport,
        imagePickerSlot,
        url,
      );
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
    const flushedBlurb = blurbFlushRef.current?.();
    if (
      flushedBlurb != null &&
      copyRef.current &&
      blurbBaselineRef.current != null &&
      flushedBlurb !== blurbBaselineRef.current
    ) {
      const next = setReportCopyValueAtPath(
        copyRef.current,
        "copy.blurb",
        flushedBlurb,
      ) as LeaseAppraisalCopy;
      copyRef.current = next;
      setCopy(next);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    flushPendingEdits,
    getPreviewReport: () => previewReport,
    savePendingEdits: () => persistCopy({ silent: true }),
  }));

  async function persistCopy(options?: { silent?: boolean }) {
    flushPendingEdits();
    const copyToSave = copyRef.current;
    const imagesToSave = propertyImagesRef.current;
    if (!copyToSave || !templateId) {
      return true;
    }

    if (
      !needsRebuild &&
      editorSnapshot(copyToSave, imagesToSave) === lastSavedSnapshot
    ) {
      return true;
    }

    setSaving(true);
    setSaveFailed(false);
    try {
      const response = await fetch(
        `/api/reports/${report.id}/lease-appraisal-copy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            copy: copyToSave,
            template_id: templateId,
            property_images: imagesToSave ?? undefined,
          }),
        },
      );
      const payload = (await response.json()) as ApiError & {
        report?: Report;
        listing?: Listing;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save appraisal");
      }
      if (payload.report) onReportChange(payload.report);
      if (payload.listing) onListingChange(payload.listing);
      setLastSavedSnapshot(editorSnapshot(copyToSave, imagesToSave));
      if (!options?.silent) toast.success("Appraisal saved");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save appraisal",
      );
      setSaveFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
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

    if (
      !hasLeaseAppraisalComps(parsed) ||
      !hasLeaseAppraisalSelectedComps(parsed)
    ) {
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

      toast.success("Appraisal generated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate collateral",
      );
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    onBusyChange?.(saving || generating);
    return () => onBusyChange?.(false);
  }, [saving, generating, onBusyChange]);

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
      if (path === "copy.blurb" && value === blurbBaselineRef.current) return;
      commitCopy(
        (current) =>
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
      title="Preparing appraisal"
      description="Writing landlord-ready rental appraisal copy from the property details and comparable rentals. This usually takes 15–30 seconds."
    >
      <div
        data-theme="staypack-workspace"
        className="flex w-full flex-col gap-5"
      >
        <AppraisalStepHeader
          title={copy ? "Make the report yours" : "Generate your appraisal"}
          description={
            copy
              ? "Click text to edit. Select a photo to replace it. Review both pages before sharing."
              : "Your chosen design and reviewed evidence are ready."
          }
          status={
            copy ? (
              <span role="status" className="du-badge du-badge-sm">
                {saving
                  ? "Saving…"
                  : isDirty || needsRebuild
                    ? "Unsaved changes"
                    : "All changes saved"}
              </span>
            ) : undefined
          }
        >
          {copy ? (
            <button
              type="button"
              className="du-btn du-btn-sm du-btn-primary min-h-11 w-full sm:w-auto"
              onClick={continueToPreview}
              disabled={generating || saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {saving
                ? "Saving…"
                : isDirty || needsRebuild
                  ? "Save & preview"
                  : "Review & download"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="du-btn du-btn-sm du-btn-primary min-h-11"
              onClick={generateContent}
              disabled={generating || saving || !compsReady}
            >
              {generating ? "Generating…" : "Generate appraisal"}
            </button>
          )}
        </AppraisalStepHeader>
        {saveFailed ? (
          <p role="alert" className="du-alert du-alert-error du-alert-soft">
            Your changes couldn’t be saved. Try Save & preview again.
          </p>
        ) : null}
        {copy ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{addressLine}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {contextSummary}
              </p>
            </div>
            <details className="max-w-md">
              <summary className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline">
                Rewrite content
              </summary>
              <p className="my-3 text-xs text-muted-foreground">
                Generate a new version using the current appraisal evidence.
                This replaces the wording and any text edits.
              </p>
              <button
                type="button"
                className="du-btn du-btn-sm du-btn-outline min-h-11"
                onClick={generateContent}
                disabled={generating || saving || !compsReady}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {confirmRegenerate ? "Confirm regenerate" : "Regenerate copy"}
              </button>
              {confirmRegenerate ? (
                <button
                  type="button"
                  className="du-btn du-btn-sm du-btn-ghost min-h-11 ml-2"
                  onClick={() => setConfirmRegenerate(false)}
                >
                  Cancel
                </button>
              ) : null}
            </details>
          </div>
        ) : null}

        {!copy ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-6 text-sm">
            <p className="font-medium">Listing context</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <CopyEditorContextMetric
                label="Bedrooms"
                value={
                  listing.bedrooms != null ? String(listing.bedrooms) : "—"
                }
              />
              <CopyEditorContextMetric
                label="Bathrooms"
                value={
                  listing.bathrooms != null ? String(listing.bathrooms) : "—"
                }
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
                label="Selected comparables"
                value={selectedCount > 0 ? String(selectedCount) : "—"}
              />
            </div>
          </div>
        ) : null}

        {previewReport && copy ? (
          <>
            <div className="mx-auto w-full max-w-4xl">
              <FittedReportPreview
                report={previewReport}
                maxHeight="min(82vh, 960px)"
                pageLabels={["Cover", "Comparable evidence"]}
                fitToWidth
                editable={{
                  setField: handleInlineSetField,
                  openImagePicker: handleOpenImagePicker,
                  brandPrimaryColour: previewReport.agency.primary_colour,
                  blurbFlushRef,
                  onFieldFocus: (path) => {
                    if (path === "copy.blurb")
                      blurbBaselineRef.current =
                        blurbFlushRef.current?.() ?? null;
                  },
                }}
              />
            </div>

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
                  ? getReportImageUrlAtSlot(
                      previewReport.property,
                      imagePickerSlot,
                    )
                  : undefined
              }
              onSelect={handleImageSelect}
            />

            <details className="group rounded-xl border border-border/70 bg-muted/10">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span>All report fields</span>
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
                  onChange={(value) =>
                    updateField("comparable_evidence", value)
                  }
                  textarea
                />
                <CopyEditorField
                  label="Comparable disclaimer"
                  value={copy.comparable_disclaimer}
                  onChange={(value) =>
                    updateField("comparable_disclaimer", value)
                  }
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
              ? "Generate the appraisal to preview and edit it here."
              : "Complete appraisal data, then generate the appraisal here."}
          </div>
        )}
      </div>
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
  const price = displayPrice;
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
