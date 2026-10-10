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
import { Loader2 } from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { DocumentGenerationStatus } from "@/components/documents/DocumentGenerationStatus";
import { reportRequest, jsonRequest } from "@/lib/reports/reportRequests";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyEditorField } from "@/components/copy-editor/primitives";
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
import { type ReportCopyFieldPath } from "@/lib/reports/editable/reportCopyPaths";
import {
  copyFromStrReport,
  setStrReportCopyValue,
  propertyImagesFromStrReport,
  strEditorSnapshot,
  type StrReportEditorCopy,
} from "@/lib/reports/editable/strReportCopyAdapter";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { formatCurrency } from "@/lib/reports/formatters";
import { resolveBlurbLengthForTemplate } from "@/lib/copy/blurbTemplateDefaults";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { getTemplateCopyFieldLimit } from "@/lib/reports/getTemplateCopyLimits";
import { resolveReportTemplateIdForReport } from "@/lib/reports/templateFromEstimateTier";
import { cn } from "@/lib/utils";
import type {
  Agency,
  AgentProfile,
  FinalReportJson,
  Listing,
  Report,
} from "@/lib/types";

type Props = {
  agency: Agency;
  agencyAgents?: AgentProfile[];
  listing: Listing;
  report: Report;
  onComplete: (report: Report) => void;
  onContinueToPreview?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

export type StrCopyEditorHandle = {
  savePendingEdits: () => Promise<boolean>;
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
      onBusyChange,
    }: Props,
    ref,
  ) {
    const resolvedTemplateId = useMemo(
      () => resolveReportTemplateIdForReport(agency, report),
      [agency, report],
    );
    const [selectedTemplateId, setSelectedTemplateId] =
      useState(resolvedTemplateId);

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
    const [imagePickerSlot, setImagePickerSlot] =
      useState<ReportImageSlot | null>(null);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [view, setView] = useState<"fields" | "layout">("fields");
    const [confirmRegenerate, setConfirmRegenerate] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(
      () => {
        const initialCopy = copyFromStrReport(report);
        return initialCopy
          ? strEditorSnapshot(initialCopy, propertyImagesFromStrReport(report))
          : null;
      },
    );

    useEffect(() => {
      const next = copyFromStrReport(report);
      const nextImages = propertyImagesFromStrReport(report);
      copyRef.current = next;
      propertyImagesRef.current = nextImages;
      setCopy(next);
      setPropertyImages(nextImages);
      setLastSavedSnapshot(next ? strEditorSnapshot(next, nextImages) : null);
    }, [report]);

    const estimate = useMemo(() => resolveReportEstimate(report), [report]);
    const displayPrice = useMemo(
      () => resolveReportDisplayPrice(listing),
      [listing],
    );

    const currentSnapshot = copy
      ? strEditorSnapshot(copy, propertyImages)
      : null;
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
      (updater: (current: StrReportEditorCopy) => StrReportEditorCopy) => {
        if (!copyRef.current) return;
        const next = updater(copyRef.current);
        copyRef.current = next;
        setCopy(next);
      },
      [],
    );

    const flushPendingEdits = useCallback(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const flushedBlurb = blurbFlushRef.current?.();
      if (flushedBlurb != null && copyRef.current) {
        const next = setStrReportCopyValue(
          copyRef.current,
          "copy.blurb",
          flushedBlurb,
          selectedTemplateId,
        ) as StrReportEditorCopy;
        copyRef.current = next;
        setCopy(next);
      }
    }, [selectedTemplateId]);

    useImperativeHandle(ref, () => ({
      savePendingEdits: () => persistCopy({ silent: true }),
      flushPendingEdits,
      getPreviewReport: () => previewReport,
    }));

    async function persistCopy(options?: { silent?: boolean }) {
      flushPendingEdits();
      const copyToSave = copyRef.current;
      const imagesToSave = propertyImagesRef.current;
      if (
        !copyToSave ||
        strEditorSnapshot(copyToSave, imagesToSave) === lastSavedSnapshot
      )
        return true;
      setSaving(true);
      onBusyChange?.(true);
      setSaveFailed(false);
      try {
        const payload = await reportRequest<{ report: Report }>(
          `/api/reports/${report.id}/str-report-copy`,
          jsonRequest(
            {
              copy: copyToSave,
              template_id: selectedTemplateId,
              property_images: imagesToSave ?? undefined,
            },
            "PATCH",
          ),
        );
        if (!payload.report)
          throw new Error("The report was not saved. Please try again.");
        onComplete(payload.report);
        setLastSavedSnapshot(strEditorSnapshot(copyToSave, imagesToSave));
        if (!options?.silent) toast.success("Report saved");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to save report",
        );
        setSaveFailed(true);
        return false;
      } finally {
        setSaving(false);
        onBusyChange?.(false);
      }
    }

    async function generateCopy() {
      if (copy && !confirmRegenerate) {
        setConfirmRegenerate(true);
        return;
      }
      if (!estimate) return;
      setConfirmRegenerate(false);
      if (!(await persistCopy({ silent: true }))) return;
      setGenerating(true);
      onBusyChange?.(true);
      try {
        const payload = await reportRequest<{ report: Report }>(
          `/api/reports/${report.id}/generate-copy`,
          jsonRequest({ template_id: selectedTemplateId }),
        );
        if (!payload.report)
          throw new Error("The report was not generated. Please try again.");
        onComplete(payload.report);
        toast.success("Report wording generated");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to generate report",
        );
      } finally {
        setGenerating(false);
        onBusyChange?.(false);
      }
    }

    function continueToPreview() {
      onContinueToPreview?.();
    }

    function updateField<K extends keyof StrReportEditorCopy>(
      field: K,
      value: StrReportEditorCopy[K],
    ) {
      commitCopy((current) => ({ ...current, [field]: value }));
    }

    const handleInlineSetField = useCallback(
      (path: ReportCopyFieldPath, value: string) => {
        commitCopy(
          (current) =>
            setStrReportCopyValue(
              current,
              path,
              value,
              selectedTemplateId,
            ) as StrReportEditorCopy,
        );
      },
      [commitCopy, selectedTemplateId],
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

    const contextSummary = strListingContextSummary(
      listing,
      displayPrice,
      estimate,
    );

    if (generating)
      return (
        <DocumentGenerationStatus
          title="Writing your report"
          description="Your saved property details and estimate are ready."
          headline="Preparing your short-term rental appraisal"
          body="Writing the property summary and supporting evidence, and applying your chosen design."
          savedLabel="Design, property and estimate saved"
          activeLabel="Writing and laying out your report"
        />
      );

    return (
      <section data-theme="staypack-workspace" className="space-y-5">
        <DocumentStepHeader
          title="Edit your short-term rental report"
          description="Edit wording in the fields or on the preview. Changes are saved before you change steps."
          status={
            <span className="du-badge du-badge-sm">
              {saving ? "Saving…" : isDirty ? "Unsaved changes" : "Saved"}
            </span>
          }
        >
          <button
            type="button"
            className="du-btn du-btn-primary min-h-11"
            onClick={continueToPreview}
            disabled={saving || !copy}
          >
            {saving ? "Saving…" : "Review & download"}
          </button>
        </DocumentStepHeader>
        {saveFailed ? (
          <p role="alert" className="du-alert du-alert-error du-alert-soft">
            Your changes could not be saved. They are still here. Try Save
            changes or Review & download again.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{addressLine}</p>
            <p className="text-xs text-muted-foreground">{contextSummary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="du-btn du-btn-sm du-btn-outline min-h-11"
              aria-pressed={view === "fields"}
              onClick={() => {
                flushPendingEdits();
                setView("fields");
              }}
              disabled={saving}
            >
              Edit text
            </button>
            <button
              type="button"
              className="du-btn du-btn-sm du-btn-outline min-h-11"
              aria-pressed={view === "layout"}
              onClick={() => {
                flushPendingEdits();
                setView("layout");
              }}
              disabled={saving}
            >
              Preview layout
            </button>
            <button
              type="button"
              className="du-btn du-btn-sm du-btn-outline min-h-11"
              onClick={() => handleOpenImagePicker("hero")}
              disabled={saving || !copy}
            >
              Change cover photo
            </button>
            {isDirty ? (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void persistCopy()}
              >
                {saving ? <Loader2 className="animate-spin" /> : null}Save
                changes
              </Button>
            ) : null}
            <button
              type="button"
              className="du-btn du-btn-sm du-btn-ghost min-h-11"
              onClick={() => void generateCopy()}
              disabled={saving || !estimate}
            >
              {confirmRegenerate ? "Replace wording" : "Rewrite wording"}
            </button>
          </div>
        </div>
        {confirmRegenerate ? (
          <div role="alert" className="du-alert du-alert-warning du-alert-soft">
            <p>
              Rewriting replaces your current wording, including unsaved text.
              Your chosen photos and design are kept.
            </p>
            <button
              type="button"
              className="du-btn du-btn-sm min-h-11"
              onClick={() => setConfirmRegenerate(false)}
            >
              Keep current wording
            </button>
          </div>
        ) : null}
        {previewReport && copy ? (
          <fieldset
            disabled={saving}
            className={cn(
              "grid min-w-0 items-start gap-6",
              view === "fields" &&
                "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]",
            )}
          >
            <div
              className={cn(
                "min-w-0 space-y-4 rounded-xl border border-base-300 bg-base-100 p-4 sm:p-5",
                view === "layout" && "hidden",
              )}
            >
              <CopyEditorField
                label="Heading"
                value={copy.heading}
                onChange={(value) => updateField("heading", value)}
                limit={headingLimit}
              />
              <CopyEditorField
                label="Property description"
                value={
                  copy.blurb_variants?.[
                    resolveBlurbLengthForTemplate(selectedTemplateId, "str")
                  ] ?? copy.blurb
                }
                onChange={(value) => handleInlineSetField("copy.blurb", value)}
                textarea
                hint="This wording is used by your selected design. You can review alternative lengths below."
              />
              <details className="rounded-lg border border-base-300 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Alternative wording lengths
                </summary>
                <div className="mt-4">
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
                </div>
              </details>
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
              <details className="rounded-lg border border-base-300 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Supporting wording & disclaimer
                </summary>
                <div className="mt-4 space-y-4">
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
            </div>
            <div
              className={cn(
                "min-w-0 space-y-4",
                view === "fields" && "hidden lg:block",
              )}
            >
              <FittedReportPreview
                pageLabels={["Overview", "Market evidence"]}
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
                    ? getReportImageUrlAtSlot(
                        previewReport.property,
                        imagePickerSlot,
                      )
                    : undefined
                }
                onSelect={handleImageSelect}
              />
            </div>
          </fieldset>
        ) : (
          <div className="rounded-xl border border-base-300 bg-base-100 p-6">
            <p>Review your estimate before generating the report.</p>
            <Button
              className="mt-4"
              onClick={() => void generateCopy()}
              disabled={!estimate}
            >
              Generate report
            </Button>
          </div>
        )}
        {copy ? (
          <div className="flex justify-end border-t border-base-300 pt-4 lg:hidden">
            <button
              type="button"
              className="du-btn du-btn-primary min-h-11"
              disabled={saving}
              onClick={continueToPreview}
            >
              Continue to download
            </button>
          </div>
        ) : null}
      </section>
    );
  },
);

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
