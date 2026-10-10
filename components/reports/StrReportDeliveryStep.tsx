"use client";

import { useState } from "react";
import { DocumentDeliveryStep } from "@/components/documents/DocumentDeliveryStep";
import { DocumentLinkEditor } from "@/components/documents/DocumentLinkEditor";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { prepareReportPdf, reportRequest } from "@/lib/reports/reportRequests";
import type { FinalReportJson, Report } from "@/lib/types";

export function StrReportDeliveryStep({
  report,
  preview,
  onReportChange,
  onEdit,
  onBusyChange,
}: {
  report: Report;
  preview: FinalReportJson;
  onReportChange: (report: Report) => void;
  onEdit: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [linkPending, setLinkPending] = useState(false);
  const [recovering, setRecovering] = useState(false);
  return (
    <DocumentDeliveryStep
      name="appraisal"
      preview={
        <FittedReportPreview
          pageLabels={["Overview", "Market evidence"]}
          report={preview}
          maxHeight="min(82vh, 960px)"
          fitToWidth
        />
      }
      pdfReady={Boolean(report.pdf_url)}
      downloadUrl={`/api/reports/${report.id}/download?v=${encodeURIComponent(report.updated_at)}`}
      publicUrl={report.public_url}
      published={report.status === "published"}
      hasLinkDraft={Boolean(report.final_report_json?.document_link_draft)}
      linkPending={linkPending}
      pdfProgressText={
        recovering
          ? "Still preparing. Checking for your completed PDF…"
          : undefined
      }
      onPreparePdf={async () => {
        setRecovering(false);
        onReportChange(
          await prepareReportPdf(report, () => setRecovering(true)),
        );
      }}
      onPublish={async () => {
        const payload = await reportRequest<{ report: Report }>(
          `/api/reports/${report.id}/publish`,
          { method: "POST" },
        );
        onReportChange(payload.report);
      }}
      onEdit={onEdit}
      onBusyChange={onBusyChange}
      renderLinkEditor={(busy) =>
        report.final_report_json ? (
          <DocumentLinkEditor
            document={report.final_report_json}
            endpoint={`/api/reports/${report.id}/link`}
            allowReport
            disabled={busy}
            onPendingChange={setLinkPending}
            onSaved={(payload) => onReportChange(payload.report as Report)}
          />
        ) : null
      }
    />
  );
}
