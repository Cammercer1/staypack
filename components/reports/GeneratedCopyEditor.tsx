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
} from "@/components/copy-editor/primitives";
import { BlurbVariantsEditor } from "@/components/collateral/sales-brochure/BlurbVariantsEditor";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { ReportImagePickerDialog } from "@/components/reports/inline/ReportImagePickerDialog";
import { ReportTemplatePicker } from "@/components/reports/ReportTemplatePicker";
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
import {
  copyFromStrReport,
  propertyImagesFromStrReport,
  strEditorSnapshot,
  type StrReportEditorCopy,
} from "@/lib/reports/editable/strReportCopyAdapter";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { getTemplateCopyFieldLimit } from "@/lib/reports/getTemplateCopyLimits";
import { resolveReportTemplateIdForReport } from "@/lib/reports/templateFromEstimateTier";
import { cn } from "@/lib/utils";
import type { Agency, AgentProfile, FinalReportJson, Listing, Report } from "@/lib/types";

type Props = {
  agency: Agency;
  agencyAgents?: AgentProfile[];
  listing: Listing;
  report: Report;
  onComplete: (report: Report) => void;
  onContinueToPreview?: () => void;
};

type ApiError = {
  error?: string;
  code?: string;
};

export type StrCopyEditorHandle = {
  flushPendingEdits: () => void;
  getPreviewReport: () => FinalReportJson | null;
};

export const GeneratedCopyEditor = forwardRef<StrCopyEditorHandle, Props>(
  function GeneratedCopyEditor(
    {
      agency,
      agencyAgents = [],
      listing,
      report,
      onComplete,
      onContinueToPreview,
    }: Props,
    ref,
  ) {
    const resolvedTemplateId = useMemo(
      () => resolveReportTemplateIdForReport(agency, report),
      [agency, report],
    );
    const [selectedTemplateId, setSelectedTemplateId] = useState(resolvedTemplateId);

    useEffect(() => {
      setSelectedTemplateId(resolvedTemplateId);
    }, [resolvedTemplateId]);

    const [copy, setCopy] = useState<StrReportEditorCopy | null>(() =>
      copyFromStrReport(report),
    );
    const copyRef = useRef(copy);
    const blurbFlushRef = useRef<(() => string | null) | null>(null);
    const [propertyImages, setPropertyImages] =
      useState<ReportPropertyImageSelection | null>(() =>
        propertyImagesFromStrReport(report),
      );
    const propertyImagesRef = useRef(propertyImages);
    const [imagePickerSlot, setImagePickerSlot] = useState<ReportImageSlot | null>(
      null,
    );
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmRegenerate, setConfirmRegenerate] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(() => {
      const initialCopy = copyFromStrReport(report);
      return initialCopy
        ? strEditorSnapshot(initialCopy, propertyImagesFromStrReport(report))
        : null;
    });

    useEffect(() => {
      const next = copyFromStrReport(report);
      const nextImages = propertyImagesFromStrReport(report);
      copyRef.current = next;
      propertyImagesRef.current = nextImages;
      setCopy(next);
      setPropertyImages(nextImages);
      setLastSavedSnapshot(
        next ? strEditorSnapshot(next, nextImages) : null,
      );
    }, [report.final_report_json, report.ai_copy_json, report.updated_at]);

    const estimate = useMemo(() => resolveReportEstimate(report), [report]);
    const displayPrice = useMemo(
      () => resolveReportDisplayPrice(listing),
      [listing],
    );

    const currentSnapshot = copy ? strEditorSnapshot(copy, propertyImages) : null;
    const isDirty =
      currentSnapshot != null &&
      lastSavedSnapshot != null &&
      currentSnapshot !== lastSavedSnapshot;

    const previewReport = useMemo(() => {
      if (!copy || !estimate) {
        return null;
      }

      const built = buildFinalReportJson({
        agency,
        agencyAgents,
        listing,
        report: {
          ...report,
          template_id: selectedTemplateId,
        },
        estimate,
        copy: {
          sales_pack_heading: copy.heading,
          sales_pack_blurb: copy.blurb,
          sales_pack_blurb_variants: copy.blurb_variants,
          key_metrics_line: copy.key_metrics_line,
          property_appeal_points: copy.appeal_points,
          performance_supporting_factors: copy.supporting_factors,
          buyer_checks: copy.buyer_checks,
          methodology_note: copy.methodology_note,
          disclaimer: copy.disclaimer,
          confidence_notes: report.ai_copy_json?.confidence_notes ?? "",
        },
        scraped: listing.scraped_listing_json,
        propertyImages,
      });

      return resolveFinalReportForDisplay(built);
    }, [
      agency,
      agencyAgents,
      copy,
      estimate,
      listing,
      propertyImages,
      report,
      selectedTemplateId,
    ]);

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
      (updater: (current: StrReportEditorCopy) => StrReportEditorCopy) => {
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
      if (flushedBlurb != null && copyRef.current) {
        const next = setReportCopyValueAtPath(
          copyRef.current,
          "copy.blurb",
          flushedBlurb,
        ) as StrReportEditorCopy;
        copyRef.current = next;
        setCopy(next);
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
      if (!copyToSave) {
        return true;
      }

      setSaving(true);
      setSaveFailed(false);
      const response = await fetch(`/api/reports/${report.id}/str-report-copy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copy: copyToSave,
          template_id: selectedTemplateId,
          property_images: imagesToSave ?? undefined,
        }),
      });
      const payload = (await response.json()) as ApiError & { report?: Report };

      if (!response.ok) {
        toast.error(getErrorMessage(payload));
        setSaveFailed(true);
        setSaving(false);
        return false;
      }

      if (payload.report) {
        onComplete(payload.report);
      }

      setLastSavedSnapshot(strEditorSnapshot(copyToSave, imagesToSave));
      if (!options?.silent) {
        toast.success("Collateral saved");
      }
      setSaving(false);
      return true;
    }

    async function generateCopy() {
      if (copy && !confirmRegenerate) {
        setConfirmRegenerate(true);
        return;
      }

      setConfirmRegenerate(false);

      if (!estimate) {
        toast.error("Run an STR estimate before generating collateral");
        return;
      }

      setGenerating(true);
      const response = await fetch(`/api/reports/${report.id}/generate-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplateId }),
      });
      const payload = (await response.json()) as ApiError & {
        copy?: unknown;
        report?: Report;
      };

      if (!response.ok) {
        toast.error(getErrorMessage(payload));
        setGenerating(false);
        return;
      }

      if (payload.report) {
        onComplete(payload.report);
        const nextCopy = copyFromStrReport(payload.report);
        copyRef.current = nextCopy;
        setCopy(nextCopy);
        if (nextCopy) {
          const nextImages = propertyImagesFromStrReport(payload.report);
          propertyImagesRef.current = nextImages;
          setPropertyImages(nextImages);
          setLastSavedSnapshot(strEditorSnapshot(nextCopy, nextImages));
        }
      }

      toast.success("Collateral generated");
      setGenerating(false);
    }

    async function continueToPreview() {
      if (isDirty) {
        return;
      }
      if (copy) {
        const saved = await persistCopy({ silent: true });
        if (!saved) {
          return;
        }
      }
      onContinueToPreview?.();
    }

    async function handleTemplateChange(templateId: string) {
      setSelectedTemplateId(templateId);

      if (!copy) {
        return;
      }

      setSaving(true);
      const response = await fetch(`/api/reports/${report.id}/str-report-copy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copy,
          template_id: templateId,
          property_images: propertyImages ?? undefined,
        }),
      });
      const payload = (await response.json()) as ApiError & { report?: Report };
      setSaving(false);

      if (!response.ok) {
        toast.error(getErrorMessage(payload));
        return;
      }

      if (payload.report) {
        onComplete(payload.report);
      }
    }

    function updateField<K extends keyof StrReportEditorCopy>(
      field: K,
      value: StrReportEditorCopy[K],
    ) {
      commitCopy((current) => ({ ...current, [field]: value }));
    }

    const handleInlineSetField = useCallback(
      (path: ReportCopyFieldPath, value: string) => {
        commitCopy((current) =>
          setReportCopyValueAtPath(current, path, value) as StrReportEditorCopy,
        );
      },
      [commitCopy],
    );

    const headingLimit = getTemplateCopyFieldLimit(
      selectedTemplateId,
      "sales_pack_heading",
    );

    const addressLine = [
      listing.property_address,
      listing.suburb,
      listing.state,
      listing.postcode,
    ]
      .filter(Boolean)
      .join(", ");

    const contextSummary = strListingContextSummary(listing, displayPrice, estimate);

    return (
      <AsyncLoadingOverlay
        active={generating}
        title="Generating collateral"
        description="Writing buyer-facing collateral from your listing and STR numbers. This usually takes 10–20 seconds."
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
                {copy ? "Edit STR report" : "Content generation"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy
                  ? "Hover photos on the preview and click Change photo to pick another image or floor plan. Click text to edit copy inline."
                  : "Generate buyer-facing collateral from your listing and STR estimate, then edit directly on the report."}
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
                <p className="mt-1 text-xs text-destructive">
                  Save failed — try again below.
                </p>
              ) : null}
              {!estimate && !copy ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Run an STR estimate before generating collateral.
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
                onClick={generateCopy}
                disabled={generating || saving || !estimate}
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
              <p className="font-medium">Report context</p>
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
                {estimate ? (
                  <>
                    <CopyEditorContextMetric
                      label="Annual revenue"
                      value={formatCurrency(estimate.annualRevenue)}
                    />
                    <CopyEditorContextMetric
                      label="Occupancy"
                      value={formatPercent(estimate.occupancyRate)}
                    />
                    <CopyEditorContextMetric
                      label="Nightly rate"
                      value={formatCurrency(estimate.nightlyRate)}
                    />
                  </>
                ) : null}
              </div>
              {!displayPrice ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Add a numeric listing price on the Review listing step to show
                  estimated gross STR yield on the report.
                </p>
              ) : null}
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
                  blurbFlushRef,
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
                    Template, headings, blurb variants, appeal points, legal
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 border-t border-border/70 px-4 py-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Report template</p>
                    <ReportTemplatePicker
                      value={selectedTemplateId}
                      onChange={handleTemplateChange}
                    />
                  </div>
                  <CopyEditorField
                    label="Heading"
                    value={copy.heading}
                    onChange={(value) => updateField("heading", value)}
                    limit={headingLimit}
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
                    label="Appeal points"
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
                    label="Key metrics line"
                    value={copy.key_metrics_line}
                    onChange={(value) => updateField("key_metrics_line", value)}
                    textarea
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
                    label="Buyer checks"
                    value={copy.buyer_checks.join("\n")}
                    onChange={(value) =>
                      updateField(
                        "buyer_checks",
                        value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      )
                    }
                    textarea
                    hint="One check per line."
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
                </div>
              </details>
            </>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              {estimate
                ? "Generate collateral to preview and edit your STR report here."
                : "Run an STR estimate first, then generate collateral to preview and edit here."}
            </div>
          )}
        </div>

        {copy && isDirty ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-200/90 bg-amber-50/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-amber-800/60 dark:bg-amber-950/95"
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Unsaved changes</p>
                <p className="text-xs text-muted-foreground">
                  Save your report before continuing to preview.
                </p>
              </div>
              <Button
                size="lg"
                className="shrink-0 shadow-md"
                disabled={saving || generating}
                onClick={() => void persistCopy()}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save report"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </AsyncLoadingOverlay>
    );
  },
);

function getErrorMessage(payload: ApiError) {
  if (payload.code === "missing_estimate") {
    return "Run an STR estimate before generating collateral.";
  }

  if (payload.code === "validation_failed") {
    return "Generated collateral did not pass validation. Try again.";
  }

  return payload.error ?? "Collateral generation failed";
}

function strListingContextSummary(
  listing: Listing,
  displayPrice: string | null | undefined,
  estimate: ReturnType<typeof resolveReportEstimate>,
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
  if (estimate?.annualRevenue != null) {
    parts.push(`Est. revenue: ${formatCurrency(estimate.annualRevenue)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
