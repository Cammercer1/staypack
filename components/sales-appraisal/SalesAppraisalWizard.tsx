"use client";

import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";

import {
  resolveAppraisalInput,
  appraisalInputError,
} from "@/lib/appraisals/resolveAppraisalInput";
import { applyDocumentLinkDraft } from "@/lib/documents/documentLink";

import { AppraisalDeliveryStep } from "@/components/appraisals/AppraisalDeliveryStep";
import { AppraisalGenerationStatus } from "@/components/appraisals/AppraisalGenerationStatus";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SalesAppraisalTemplateStep } from "@/components/sales-appraisal/SalesAppraisalTemplateStep";
import { SalesAppraisalDataStep } from "@/components/sales-appraisal/SalesAppraisalDataStep";
import {
  SalesAppraisalCopyEditor,
  type SalesAppraisalCopyEditorHandle,
} from "@/components/sales-appraisal/SalesAppraisalCopyEditor";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { hasSalesAppraisalComps } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import { hasSalesAppraisalSelectedComps } from "@/lib/sales-appraisal/salesAppraisalData";
import {
  getInitialSalesAppraisalWizardStep,
  SALES_APPRAISAL_WIZARD_STEPS,
  type SalesAppraisalWizardStep,
} from "@/lib/sales-appraisal/salesAppraisalWizardFlow";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  FinalReportJson,
  Listing,
  Report,
  SalesAppraisalJob,
} from "@/lib/types";

type Props = {
  availableTemplates?: TemplatesResponse;
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
  availableTemplates,
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
      hasComps: hasSalesAppraisalComps(resolveAppraisalInput(initialListing)),
      hasSelectedComps: hasSalesAppraisalSelectedComps(
        resolveAppraisalInput(initialListing),
      ),
      isPublished: initialReport.status === "published",
      skipTemplateSelection,
    }),
  );
  const [evidenceChanged, setEvidenceChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const copyEditorRef = useRef<SalesAppraisalCopyEditorHandle>(null);
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
    compsPrefetchStartedRef.current = false;
    setSalesAppraisalJob(null);
  }, [listing.id]);

  useEffect(() => {
    if (hasSalesAppraisalComps(resolveAppraisalInput(listing))) {
      setCompsPrefetching(false);
      return;
    }
    if (appraisalInputError(listing)) return;
    if (compsPrefetchStartedRef.current) {
      return;
    }
    compsPrefetchStartedRef.current = true;

    let cancelled = false;
    setCompsPrefetching(true);

    fetch(`/api/listings/${listing.id}/sales-appraisal/enrich`, {
      method: "POST",
    })
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
  }, [listing]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const previewReport = useMemo(() => {
    const rawCached = report.final_report_json as FinalReportJson | null;
    const cached = rawCached ? applyDocumentLinkDraft(rawCached) : null;
    if (!cached) {
      return null;
    }
    return resolveFinalReportForDisplay(cached);
  }, [report.final_report_json]);

  async function handleStepChange(next: string) {
    if (next === step || loading || generating) return;
    if (step === "copy" && copyEditorRef.current) {
      setLoading(true);
      try {
        if (!(await copyEditorRef.current.savePendingEdits())) return;
      } finally {
        setLoading(false);
      }
    }
    setStep(next as SalesAppraisalWizardStep);
  }

  async function continueFromData() {
    setStep("copy");
    if (report.final_report_json) {
      setEvidenceChanged(true);
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch(
        `/api/reports/${report.id}/generate-sales-appraisal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: report.template_id ?? collateral.template_id,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.report)
        throw new Error(
          payload.error ?? "Unable to generate appraisal. Try again.",
        );
      setReport(payload.report);
      if (payload.listing) setListing(payload.listing);
      setCollateral({ ...collateral, status: "generated" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate appraisal. Try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const hasTemplate = Boolean(report.template_id || collateral.template_id);
  const steps = skipTemplateSelection
    ? SALES_APPRAISAL_WIZARD_STEPS.filter((item) => item.id !== "template")
    : SALES_APPRAISAL_WIZARD_STEPS;

  return (
    <div data-theme="staypack-workspace" className="space-y-6">
      <Tabs
        value={step}
        onValueChange={(next) => void handleStepChange(next)}
        className="gap-4"
      >
        <TabsList
          className={
            steps.length === 3
              ? "grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:grid-cols-3"
              : "grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:grid-cols-4"
          }
        >
          {steps.map((item, index) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              disabled={
                loading ||
                generating ||
                (item.id === "preview" &&
                  (!report.final_report_json ||
                    (step !== "copy" &&
                      (evidenceChanged ||
                        report.template_id !==
                          report.final_report_json.template_id)))) ||
                (item.id !== "template" && !hasTemplate)
              }
              className="h-auto min-h-12 gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs opacity-60"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {!skipTemplateSelection ? (
          <TabsContent value="template">
            <SalesAppraisalTemplateStep
              availableTemplates={availableTemplates}
              onBusyChange={setLoading}
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
              onBusyChange={setLoading}
              listing={listing}
              activeJob={salesAppraisalJob}
              compsPrefetching={compsPrefetching}
              onListingChange={setListing}
              onJobChange={setSalesAppraisalJob}
              continueLabel={
                report.final_report_json
                  ? "Save & edit report"
                  : "Save & generate report"
              }
              onContinue={() => void continueFromData()}
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
          {generating ? (
            <AppraisalGenerationStatus />
          ) : hasTemplate ? (
            <SalesAppraisalCopyEditor
              onBusyChange={setLoading}
              ref={copyEditorRef}
              needsRebuild={
                evidenceChanged ||
                report.template_id !== report.final_report_json?.template_id
              }
              agency={agency}
              agencyAgents={agencyAgents}
              listing={listing}
              report={report}
              collateral={collateral}
              onListingChange={setListing}
              onReportChange={(next) => {
                setReport(next);
                setEvidenceChanged(false);
              }}
              onCollateralChange={setCollateral}
              onContinueToPreview={() => setStep("preview")}
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

        <TabsContent value="preview">
          {previewReport ? (
            <AppraisalDeliveryStep
              report={report}
              preview={previewReport}
              onReportChange={setReport}
              onEdit={() => void handleStepChange("copy")}
              onBusyChange={setLoading}
            />
          ) : (
            <StepGate
              message="Generate your appraisal to review and download it."
              onBack={() => setStep("data")}
            />
          )}
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
