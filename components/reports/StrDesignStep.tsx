"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppraisalTemplateGallery } from "@/components/appraisals/AppraisalTemplateGallery";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import { buildStrTemplatePreview } from "@/lib/reports/templatePreviewDocument";
import { resolveReportTemplateIdForReport } from "@/lib/reports/templateFromEstimateTier";
import type { Agency, AgentProfile, Listing, Report } from "@/lib/types";

export type StrDesignHandle = { read: () => string | null };

export const StrDesignStep = forwardRef<
  StrDesignHandle,
  {
    agency: Agency;
    agencyAgents: AgentProfile[];
    listing: Listing;
    report: Report;
    availableTemplates?: TemplatesResponse;
    busy: boolean;
    onContinue: () => void;
    onBack: () => void;
  }
>(function StrDesignStep(
  {
    agency,
    agencyAgents,
    listing,
    report,
    availableTemplates,
    busy,
    onContinue,
    onBack,
  },
  ref,
) {
  const [templateId, setTemplateId] = useState(() =>
    report.template_id ?? availableTemplates?.default_template_id ?? resolveReportTemplateIdForReport(agency, report),
  );
  const [ready, setReady] = useState(false);
  useImperativeHandle(ref, () => ({ read: () => ready ? templateId : null }));
  const previewForTemplate = (id: string) =>
    buildStrTemplatePreview({
      agency,
      agencyAgents,
      listing,
      report,
      templateId: id,
    });
  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title="Choose your report design"
        description="Choose a layout using your saved property and estimates, then personalise the wording and photos."
      >
        <button type="button" className="du-btn du-btn-ghost min-h-11" disabled={busy} onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" />Back to evidence</button>
        <button
          type="button"
          className="du-btn du-btn-primary min-h-11 h-auto py-3 whitespace-normal"
          disabled={busy || !ready}
          onClick={onContinue}
        >
          {report.final_report_json
            ? "Use design & edit content"
            : "Use design & write report"}
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </DocumentStepHeader>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <AppraisalTemplateGallery
          product="str"
          description={report.final_report_json ? "Your saved figures, wording and photos carry across when you change designs." : "Your saved estimates are shown in each design. Sample wording will be replaced when you write the report."}
          initialTemplates={availableTemplates}
          value={templateId}
          onChange={setTemplateId}
          previewForTemplate={previewForTemplate}
          disabled={busy}
          onReady={setReady}
        />
        <div className="min-w-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your property · Design preview
            {!report.ai_copy_json && !report.final_report_json ? " · Sample wording" : ""}
          </p>
          <FittedReportPreview
            pageLabels={["Overview", "Market evidence"]}
            report={previewForTemplate(templateId)}
            maxHeight="min(75vh, 850px)"
            fitToWidth
          />
          {!report.ai_copy_json && !report.final_report_json ? (
            <p className="text-xs text-muted-foreground">
              The figures are your saved estimates; the wording is a preview until you write the report.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
});
