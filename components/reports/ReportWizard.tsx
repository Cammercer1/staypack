"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StrEstimateStep } from "@/components/reports/StrEstimateStep";
import {
  GeneratedCopyEditor,
  type StrCopyEditorHandle,
} from "@/components/reports/GeneratedCopyEditor";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { CopyLinkButton } from "@/components/reports/CopyLinkButton";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import type { Agency, AgentProfile, FinalReportJson, Listing, Report } from "@/lib/types";

const PREVIEW_SYNC_MIN_MS = 400;

const steps = [
  { id: "estimate", label: "STR estimate" },
  { id: "copy", label: "Generate collateral" },
  { id: "preview", label: "Preview & publish" },
];

export function ReportWizard({
  initialListing,
  initialReport,
  agency,
  onListingChange,
  onReportChange,
}: {
  initialListing: Listing;
  initialReport: Report;
  agency: Agency;
  onListingChange?: (listing: Listing) => void;
  onReportChange?: (report: Report) => void;
}) {
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);
  const [previewAgency, setPreviewAgency] = useState<Agency | null>(null);
  const [step, setStep] = useState(getInitialStep(initialReport));
  const [loading, setLoading] = useState(false);
  const [publishStage, setPublishStage] = useState<
    "idle" | "publishing" | "generating-pdf"
  >("idle");
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>([]);
  const copyEditorRef = useRef<StrCopyEditorHandle>(null);
  const previewSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewSyncing, setPreviewSyncing] = useState(false);
  const [previewDraftReport, setPreviewDraftReport] = useState<FinalReportJson | null>(
    () => (initialReport.final_report_json as FinalReportJson | null) ?? null,
  );

  function updateListing(nextListing: Listing) {
    setListing(nextListing);
    onListingChange?.(nextListing);
  }

  function updateReport(nextReport: Report) {
    setReport(nextReport);
    const cached = nextReport.final_report_json as FinalReportJson | null;
    if (cached) {
      setPreviewDraftReport(cached);
    }
    onReportChange?.(nextReport);
  }

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => response.json())
      .then((payload) => setAgencyAgents(payload.agents ?? []))
      .catch(() => {
        // Non-blocking — agent enrichment falls back to scraped listing data.
      });
  }, []);

  useEffect(() => {
    return () => {
      if (previewSyncTimeoutRef.current) {
        clearTimeout(previewSyncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (step !== "preview") {
      return;
    }

    let cancelled = false;

    fetch("/api/agencies")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload.agency) {
          setPreviewAgency(payload.agency);
        }
      })
      .catch(() => {
        // Keep the last known brand settings if refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [step]);

  const brandAgency = previewAgency?.id === agency.id ? previewAgency : agency;

  const previewReport = useMemo(() => {
    const cached =
      previewDraftReport ?? (report.final_report_json as FinalReportJson | null);
    if (!cached) {
      return null;
    }

    const enriched = enrichFinalReportMetrics(
      listing,
      mergeAgencyBrandIntoFinalReport(brandAgency, cached),
      { agencyAgents },
    );
    return resolveFinalReportForDisplay(enriched);
  }, [brandAgency, listing, previewDraftReport, report.final_report_json, agencyAgents]);

  function handleStepChange(next: string) {
    if (next === "preview") {
      if (step === "preview") {
        return;
      }

      copyEditorRef.current?.flushPendingEdits();
      const live = copyEditorRef.current?.getPreviewReport();
      if (live) {
        setPreviewDraftReport(live);
      }

      if (previewSyncTimeoutRef.current) {
        clearTimeout(previewSyncTimeoutRef.current);
      }
      setPreviewSyncing(true);
      setStep("preview");
      previewSyncTimeoutRef.current = setTimeout(() => {
        previewSyncTimeoutRef.current = null;
        setPreviewSyncing(false);
      }, PREVIEW_SYNC_MIN_MS);
      return;
    }

    if (previewSyncTimeoutRef.current) {
      clearTimeout(previewSyncTimeoutRef.current);
      previewSyncTimeoutRef.current = null;
    }
    setPreviewSyncing(false);
    setStep(next);
  }

  async function publishReport() {
    setLoading(true);
    setPublishStage("publishing");

    const publishResponse = await fetch(`/api/reports/${report.id}/publish`, {
      method: "POST",
    });
    const publishPayload = await publishResponse.json();

    if (!publishResponse.ok) {
      toast.error(publishPayload.error ?? "Publish failed");
      setLoading(false);
      setPublishStage("idle");
      return;
    }

    setPublishStage("generating-pdf");
    const pdfResponse = await fetch(`/api/reports/${report.id}/generate-pdf`, {
      method: "POST",
    });
    const pdfPayload = await pdfResponse.json();

    if (!pdfResponse.ok) {
      toast.error(pdfPayload.error ?? "PDF generation failed");
      setLoading(false);
      setPublishStage("idle");
      return;
    }

    updateReport(pdfPayload.report);
    toast.success("Report published");
    setLoading(false);
    setPublishStage("idle");
  }

  return (
    <div className="space-y-6">
      <Tabs value={step} onValueChange={handleStepChange}>
        <TabsList className="grid w-full grid-cols-3">
          {steps.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="estimate">
          <StrEstimateStep
            listing={listing}
            report={report}
            onComplete={({ listing: nextListing, report: nextReport }) => {
              updateListing(nextListing);
              updateReport(nextReport);
            }}
            onContinue={() => setStep("copy")}
          />
        </TabsContent>

        <TabsContent value="copy">
          <GeneratedCopyEditor
            ref={copyEditorRef}
            agency={agency}
            agencyAgents={agencyAgents}
            listing={listing}
            report={report}
            onComplete={(nextReport) => {
              updateReport(nextReport);
            }}
            onContinueToPreview={() => handleStepChange("preview")}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <AsyncLoadingOverlay
            active={loading || previewSyncing}
            title={
              previewSyncing
                ? "Refreshing preview"
                : publishStage === "generating-pdf"
                  ? "Generating PDF"
                  : "Publishing report"
            }
            description={
              previewSyncing
                ? "Applying your latest edits to the preview."
                : publishStage === "generating-pdf"
                  ? "Rendering the final buyer pack. This can take 15–30 seconds."
                  : "Saving the published report."
            }
          >
            {previewReport ? (
              <FittedReportPreview
                report={previewReport}
                maxHeight="min(80vh, 900px)"
                fitToWidth
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate collateral first to preview the report.
              </p>
            )}
          </AsyncLoadingOverlay>
          <div className="flex flex-wrap gap-3 no-print">
            <DownloadPdfButton
              url={report.pdf_url}
              reportId={report.id}
              cacheVersion={report.updated_at}
              canGenerate={Boolean(previewReport) && !loading}
              preview={report.status !== "published"}
              size="default"
              generateLabel="Generate PDF preview"
              regenerateLabel="Regenerate PDF preview"
              onGenerated={({ report: nextReport, pdf_url }) => {
                if (nextReport) {
                  updateReport(nextReport);
                  return;
                }

                if (pdf_url) {
                  updateReport({ ...report, pdf_url });
                }
              }}
            />
            {report.public_url ? (
              <CopyLinkButton url={report.public_url} />
            ) : null}
            <Button onClick={publishReport} disabled={loading || !previewReport}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  {publishStage === "generating-pdf"
                    ? "Generating PDF..."
                    : "Publishing..."}
                </>
              ) : (
                "Publish report"
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getInitialStep(report: Report) {
  if (report.status === "published" || report.status === "generated") {
    return "preview";
  }
  if (report.status === "estimated") {
    return "copy";
  }
  return "estimate";
}
