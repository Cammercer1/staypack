"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SalesAppraisalTemplateStep } from "@/components/sales-appraisal/SalesAppraisalTemplateStep";
import { SalesAppraisalDataStep } from "@/components/sales-appraisal/SalesAppraisalDataStep";
import {
  SalesAppraisalCopyEditor,
  type SalesAppraisalCopyEditorHandle,
} from "@/components/sales-appraisal/SalesAppraisalCopyEditor";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { CopyLinkButton } from "@/components/reports/CopyLinkButton";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { mergeSalesAppraisalPreviewFromListing } from "@/lib/sales-appraisal/mergeSalesAppraisalPreviewFromListing";
import { mergeAppraisalPreviewAgents } from "@/lib/reports/mergeAppraisalPreviewAgents";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { hasSalesAppraisalComps } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import { hasSalesAppraisalSelectedComps } from "@/lib/sales-appraisal/salesAppraisalData";
import {
  getInitialSalesAppraisalWizardStep,
  SALES_APPRAISAL_WIZARD_STEPS,
  type SalesAppraisalWizardStep,
} from "@/lib/sales-appraisal/salesAppraisalWizardFlow";
import { SALES_APPRAISAL_LABEL } from "@/lib/listings/collateralTypes";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  FinalReportJson,
  Listing,
  Report,
  SalesAppraisalJob,
} from "@/lib/types";

const PREVIEW_SYNC_MIN_MS = 400;

type Props = {
  initialListing: Listing;
  initialReport: Report;
  initialCollateral: CollateralItem;
  agency: Agency;
  initialAgencyAgents: AgentProfile[];
  skipTemplateSelection?: boolean;
};

export function SalesAppraisalWizard({
  initialListing,
  initialReport,
  initialCollateral,
  agency,
  initialAgencyAgents,
  skipTemplateSelection = false,
}: Props) {
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);
  const [collateral, setCollateral] = useState(initialCollateral);
  const agencyAgents = initialAgencyAgents;
  const [step, setStep] = useState(() =>
    getInitialSalesAppraisalWizardStep({
      hasFinalReport: Boolean(initialReport.final_report_json),
      hasTemplate: Boolean(
        initialReport.template_id || initialCollateral.template_id,
      ),
      hasComps: hasSalesAppraisalComps(initialListing.scraped_listing_json),
      hasSelectedComps: hasSalesAppraisalSelectedComps(
        initialListing.scraped_listing_json,
      ),
      isPublished: initialReport.status === "published",
      skipTemplateSelection,
    }),
  );
  const [loading, setLoading] = useState(false);
  const [publishStage, setPublishStage] = useState<
    "idle" | "publishing" | "generating-pdf"
  >("idle");
  const copyEditorRef = useRef<SalesAppraisalCopyEditorHandle>(null);
  const previewSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewSyncing, setPreviewSyncing] = useState(false);
  const [previewDraftReport, setPreviewDraftReport] = useState<FinalReportJson | null>(
    () => (initialReport.final_report_json as FinalReportJson | null) ?? null,
  );
  const [compsPrefetching, setCompsPrefetching] = useState(false);
  const [salesAppraisalJob, setSalesAppraisalJob] =
    useState<SalesAppraisalJob | null>(null);
  const compsPrefetchStartedRef = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect -- wizard state mirrors server-provided props and refreshed listing/report payloads. */
  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  useEffect(() => {
    setReport(initialReport);
    setCollateral(initialCollateral);
  }, [initialReport, initialCollateral]);

  useEffect(() => {
    const cached = report.final_report_json as FinalReportJson | null;
    if (cached) {
      setPreviewDraftReport(cached);
    }
  }, [report.final_report_json]);

  useEffect(() => {
    compsPrefetchStartedRef.current = false;
    setSalesAppraisalJob(null);
  }, [listing.id]);

  useEffect(() => {
    if (hasSalesAppraisalComps(listing.scraped_listing_json)) {
      setCompsPrefetching(false);
      return;
    }
    if (compsPrefetchStartedRef.current) {
      return;
    }
    compsPrefetchStartedRef.current = true;

    let cancelled = false;
    setCompsPrefetching(true);

    fetch(`/api/listings/${listing.id}/sales-appraisal/enrich`, { method: "POST" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to fetch sales comps");
        }
        if (!cancelled && payload.listing) {
          setListing(payload.listing as Listing);
        }
        if (!cancelled && payload.job) {
          setSalesAppraisalJob(payload.job as SalesAppraisalJob);
        }
      })
      .catch(() => {
        // User can refresh on the Appraisal data step.
      })
      .finally(() => {
        if (!cancelled) {
          setCompsPrefetching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listing.id, listing.scraped_listing_json]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return () => {
      if (previewSyncTimeoutRef.current) {
        clearTimeout(previewSyncTimeoutRef.current);
      }
    };
  }, []);

  const previewReport = useMemo(() => {
    const cached = previewDraftReport ?? (report.final_report_json as FinalReportJson | null);
    if (!cached) {
      return null;
    }
    const withListing = mergeSalesAppraisalPreviewFromListing(cached, listing);
    return resolveFinalReportForDisplay(
      mergeAppraisalPreviewAgents(withListing, listing, agencyAgents),
    );
  }, [previewDraftReport, report.final_report_json, listing, agencyAgents]);

  function handleStepChange(next: string) {
    if (!SALES_APPRAISAL_WIZARD_STEPS.some((item) => item.id === next)) {
      return;
    }
    const nextStep = next as SalesAppraisalWizardStep;

    if (nextStep === "preview") {
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
    setStep(nextStep);
  }

  async function publishReport() {
    if (!previewReport) {
      toast.error("Generate appraisal content before publishing");
      return;
    }

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

    if (publishPayload.report) {
      setReport(publishPayload.report);
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

    if (pdfPayload.report) {
      setReport(pdfPayload.report);
    }

    toast.success(`${SALES_APPRAISAL_LABEL} published`);
    setLoading(false);
    setPublishStage("idle");
  }

  const hasTemplate = Boolean(report.template_id || collateral.template_id);
  const steps = skipTemplateSelection
    ? SALES_APPRAISAL_WIZARD_STEPS.filter((item) => item.id !== "template")
    : SALES_APPRAISAL_WIZARD_STEPS;

  return (
    <div className="space-y-6">
      <Tabs value={step} onValueChange={handleStepChange}>
        <TabsList
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {!skipTemplateSelection ? (
          <TabsContent value="template">
            <SalesAppraisalTemplateStep
              agency={agency}
              listing={listing}
              report={report}
              collateral={collateral}
              agencyAgents={agencyAgents}
              onReportChange={setReport}
              onCollateralChange={setCollateral}
              onContinue={() => setStep("data")}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="data">
          {hasTemplate ? (
            <SalesAppraisalDataStep
              listing={listing}
              activeJob={salesAppraisalJob}
              compsPrefetching={compsPrefetching}
              onListingChange={setListing}
              onJobChange={setSalesAppraisalJob}
              onContinue={() => setStep("copy")}
            />
          ) : (
            <StepGate
              message={
                skipTemplateSelection
                  ? "Your account template is unavailable."
                  : "Choose a template first."
              }
              onBack={
                skipTemplateSelection ? undefined : () => setStep("template")
              }
            />
          )}
        </TabsContent>

        <TabsContent value="copy">
          {hasTemplate ? (
            <SalesAppraisalCopyEditor
              ref={copyEditorRef}
              agency={agency}
              agencyAgents={agencyAgents}
              listing={listing}
              report={report}
              collateral={collateral}
              onListingChange={setListing}
              onReportChange={setReport}
              onCollateralChange={setCollateral}
              onContinueToPreview={() => handleStepChange("preview")}
            />
          ) : (
            <StepGate
              message={
                skipTemplateSelection
                  ? "Your account template is unavailable."
                  : "Choose a template first."
              }
              onBack={
                skipTemplateSelection ? undefined : () => setStep("template")
              }
            />
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            To change photos or edit copy inline, open the{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => handleStepChange("copy")}
            >
              Content generation
            </button>{" "}
            tab.
          </p>
          <AsyncLoadingOverlay
            active={loading || previewSyncing}
            title={
              previewSyncing
                ? "Preparing preview"
                : publishStage === "generating-pdf"
                  ? "Generating PDF"
                  : "Publishing appraisal"
            }
            description={
              previewSyncing
                ? "Syncing your latest edits…"
                : publishStage === "generating-pdf"
                  ? "Rendering your print-ready appraisal. This can take 15–30 seconds."
                  : "Saving the published appraisal."
            }
          >
            {previewSyncing ? (
              <div
                className="min-h-[min(80vh,900px)] rounded-xl border border-transparent"
                aria-hidden
              />
            ) : previewReport ? (
              <FittedReportPreview
                report={previewReport}
                maxHeight="min(80vh, 900px)"
                fitToWidth
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate appraisal content first to preview the report.
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
                  setReport(nextReport);
                  return;
                }
                if (pdf_url) {
                  setReport({ ...report, pdf_url });
                }
              }}
            />
            {report.public_url ? <CopyLinkButton url={report.public_url} /> : null}
            <Button onClick={publishReport} disabled={loading || !previewReport}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  {publishStage === "generating-pdf"
                    ? "Generating PDF..."
                    : "Publishing..."}
                </>
              ) : report.status === "published" ? (
                "Republish appraisal"
              ) : (
                "Publish appraisal"
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StepGate({
  message,
  onBack,
}: {
  message: string;
  onBack?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      {onBack ? (
        <Button className="mt-4" variant="outline" onClick={onBack}>
          Go back
        </Button>
      ) : null}
    </div>
  );
}
