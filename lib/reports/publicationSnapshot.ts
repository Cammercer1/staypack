import { applyDocumentLinkDraft, publishedDocumentSnapshot } from "@/lib/documents/documentLink";
import type { FinalReportJson, Report } from "@/lib/types";

export class ReportChangedError extends Error {
  constructor() {
    super("This report changed while saving. Reload and try again.");
    this.name = "ReportChangedError";
  }
}

/** Public readers must never receive the editable draft or its private QR choice. */
export function publishedReportSnapshot(document: FinalReportJson): FinalReportJson {
  const snapshot = { ...(document.published_report_json ?? document) };
  delete snapshot.published_report_json;
  return publishedDocumentSnapshot(snapshot);
}

/** Preserve exactly one published revision while authenticated editors change the draft. */
export function preservePublishedReport(
  report: Pick<Report, "status" | "final_report_json">,
  draft: FinalReportJson,
): FinalReportJson {
  const next = { ...draft };
  delete next.published_report_json;
  if (report.status === "published" && report.final_report_json) {
    next.published_report_json = publishedReportSnapshot(report.final_report_json);
  }
  return next;
}

/** The current saved content, including its link, for private PDFs and explicit publication. */
export function currentReportSnapshot(document: FinalReportJson): FinalReportJson {
  const draft = { ...document };
  delete draft.published_report_json;
  return applyDocumentLinkDraft(draft);
}
