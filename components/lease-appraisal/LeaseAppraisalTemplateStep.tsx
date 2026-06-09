"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { LeaseAppraisalTemplatePicker } from "@/components/lease-appraisal/LeaseAppraisalTemplatePicker";
import {
  resolveLeaseAppraisalTemplateSelection,
} from "@/lib/lease-appraisal/leaseAppraisalTemplates";
import { resolveAgentProfile } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { buildLeaseAppraisalTemplatePreview } from "@/lib/lease-appraisal/templatePreviewDocument";
import type { Agency, AgentProfile, CollateralItem, Listing, Report } from "@/lib/types";

type Props = {
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

export function LeaseAppraisalTemplateStep({
  agency,
  listing,
  report,
  collateral,
  agencyAgents,
  onReportChange,
  onCollateralChange,
  onContinue,
}: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(() =>
    resolveLeaseAppraisalTemplateSelection(
      report.template_id ?? collateral.template_id,
    ),
  );
  const [saving, setSaving] = useState(false);

  const previewReport = useMemo(() => {
    return buildLeaseAppraisalTemplatePreview({
      agency,
      listing,
      report,
      templateId: selectedTemplateId,
      agencyAgents,
    });
  }, [agency, listing, report, selectedTemplateId, agencyAgents]);

  async function proceedToContentGeneration() {
    setSaving(true);

    const [reportResponse, collateralResponse] = await Promise.all([
      fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplateId }),
      }),
      fetch(`/api/collateral/${collateral.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplateId }),
      }),
    ]);

    const reportPayload = (await reportResponse.json()) as ApiError & {
      report?: Report;
    };
    const collateralPayload = (await collateralResponse.json()) as ApiError & {
      collateral?: CollateralItem;
    };

    if (!reportResponse.ok) {
      toast.error(reportPayload.error ?? "Unable to save template");
      setSaving(false);
      return;
    }

    if (reportPayload.report) {
      onReportChange(reportPayload.report);
    }

    if (collateralResponse.ok && collateralPayload.collateral) {
      onCollateralChange(collateralPayload.collateral);
    }

    setSaving(false);
    onContinue();
  }

  const assignedAgent = resolveAgentProfile(listing, agencyAgents);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Choose template</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the lease appraisal layout. Preview uses your agency brand
            {assignedAgent ? ` and ${assignedAgent.name}` : ""}, listing photos,
            and placeholder copy until you fetch comps and generate content.
          </p>
        </div>

        <Button
          className="shrink-0"
          onClick={proceedToContentGeneration}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              Saving...
            </>
          ) : (
            "Proceed to appraisal data"
          )}
        </Button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,22rem)_1fr]">
        <LeaseAppraisalTemplatePicker
          value={selectedTemplateId}
          onChange={setSelectedTemplateId}
        />

        <div className="min-w-0">
          {previewReport ? (
            <FittedReportPreview
              report={previewReport}
              maxHeight="min(85vh, 920px)"
              fitToWidth
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Import the listing URL first to preview templates with your photos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
