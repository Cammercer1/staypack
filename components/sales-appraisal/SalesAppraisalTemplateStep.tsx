"use client";

import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppraisalStepHeader } from "@/components/appraisals/AppraisalStepHeader";
import { AppraisalTemplateGallery } from "@/components/appraisals/AppraisalTemplateGallery";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { resolveSalesAppraisalTemplateSelection } from "@/lib/sales-appraisal/salesAppraisalTemplates";
import { buildSalesAppraisalTemplatePreview } from "@/lib/sales-appraisal/templatePreviewDocument";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
  Report,
} from "@/lib/types";

type Props = {
  availableTemplates?: TemplatesResponse;
  onBusyChange?: (busy: boolean) => void;
  agency: Agency;
  listing: Listing;
  report: Report;
  collateral: CollateralItem;
  agencyAgents: AgentProfile[];
  onReportChange: (report: Report) => void;
  onCollateralChange: (collateral: CollateralItem) => void;
  onContinue: () => void;
};

type ApiError = {
  error?: string;
};

export function SalesAppraisalTemplateStep({
  agency,
  availableTemplates,
  listing,
  report,
  collateral,
  agencyAgents,
  onReportChange,
  onCollateralChange,
  onContinue,
  onBusyChange,
}: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () =>
      report.template_id ??
      collateral.template_id ??
      resolveSalesAppraisalTemplateSelection(null),
  );
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewReport = useMemo(() => {
    return buildSalesAppraisalTemplatePreview({
      agency,
      listing,
      report,
      templateId: selectedTemplateId,
      agencyAgents,
    });
  }, [agency, listing, report, selectedTemplateId, agencyAgents]);

  useEffect(() => {
    onBusyChange?.(saving);
    return () => onBusyChange?.(false);
  }, [saving, onBusyChange]);

  async function proceedToAppraisalData() {
    if (saving || !ready) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplateId }),
      });
      const payload = (await response.json()) as ApiError & { report?: Report };
      if (!response.ok || !payload.report)
        throw new Error(payload.error ?? "Unable to save design");
      onReportChange(payload.report);
      if (collateral.report_id === report.id) {
        const collateralResponse = await fetch(
          `/api/collateral/${collateral.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template_id: selectedTemplateId }),
          },
        );
        const collateralPayload = await collateralResponse.json();
        if (!collateralResponse.ok)
          throw new Error(collateralPayload.error ?? "Unable to save design");
        if (collateralPayload.collateral)
          onCollateralChange(collateralPayload.collateral);
      }
      onContinue();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to save design. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <AppraisalStepHeader
        title="Choose your report design"
        description="See your property in each layout. You can change the design later."
      >
        <button
          type="button"
          className="du-btn du-btn-sm du-btn-primary min-h-11 w-full sm:w-auto"
          onClick={proceedToAppraisalData}
          disabled={saving || !ready}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {saving ? "Saving design…" : "Use design & review evidence"}
          {!saving ? (
            <ArrowRight className="size-4" aria-hidden="true" />
          ) : null}
        </button>
      </AppraisalStepHeader>
      {error ? (
        <p role="alert" className="du-alert du-alert-error du-alert-soft">
          {error}
        </p>
      ) : null}
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        <AppraisalTemplateGallery
          initialTemplates={availableTemplates}
          product="sales_appraisal"
          value={selectedTemplateId}
          onChange={setSelectedTemplateId}
          onReady={setReady}
          disabled={saving}
          previewForTemplate={(templateId) =>
            buildSalesAppraisalTemplatePreview({
              agency,
              listing,
              report,
              templateId,
              agencyAgents,
            })
          }
        />
        <div className="min-w-0 xl:sticky xl:top-32">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>YOUR PROPERTY · DESIGN PREVIEW</span>
            <span>Sample wording</span>
          </div>
          {previewReport ? (
            <FittedReportPreview
              report={previewReport}
              pageLabels={["Cover", "Comparable evidence"]}
              maxHeight="min(78vh, 900px)"
              fitToWidth
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Add property details and photos to preview designs.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
