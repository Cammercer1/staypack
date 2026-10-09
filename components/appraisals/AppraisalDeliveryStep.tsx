"use client";
import { useState } from "react";
import { DocumentDeliveryStep } from "@/components/documents/DocumentDeliveryStep";
import { DocumentLinkEditor } from "@/components/documents/DocumentLinkEditor";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import type { FinalReportJson, Report } from "@/lib/types";

export function AppraisalDeliveryStep({
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
  async function prepare(action: "pdf" | "publish") {
    const response = await fetch(
      `/api/reports/${report.id}/${action === "pdf" ? "generate-pdf" : "publish"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(action === "pdf"
          ? { body: JSON.stringify({ preview: report.status !== "published" }) }
          : {}),
      },
    );
    const payload = await response.json();
    if (!response.ok || !payload.report)
      throw new Error(
        payload.error ??
          `Unable to ${action === "pdf" ? "prepare PDF" : "publish report"}. Try again.`,
      );
    onReportChange(payload.report);
  }
  return (
    <DocumentDeliveryStep
      name="appraisal"
      preview={
        <FittedReportPreview
          report={preview}
          pageLabels={["Cover", "Comparable evidence"]}
          maxHeight="min(82vh, 960px)"
          fitToWidth
        />
      }
      pdfReady={Boolean(report.pdf_url)}
      downloadUrl={`/api/reports/${report.id}/download?v=${encodeURIComponent(report.updated_at ?? "")}`}
      publicUrl={report.public_url}
      published={report.status === "published"}
      hasLinkDraft={Boolean(report.final_report_json?.document_link_draft)}
      linkPending={linkPending}
      onPreparePdf={() => prepare("pdf")}
      onPublish={() => prepare("publish")}
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
