import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PublicProposal } from "@/components/digital-proposals/PublicProposal";
import { ProposalTracking } from "@/components/digital-proposals/ProposalTracking";
import type { PublicReportPayload } from "@/lib/public-delivery/payload";

class ReportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="p-8" role="alert"><h1>This proposal could not be loaded.</h1><a href={location.href}>Try again</a></main> : this.props.children;
  }
}

const element = document.getElementById("public-report-data");
const root = document.getElementById("public-report-root");
if (element && root) {
  const payload: PublicReportPayload = JSON.parse(element.textContent!);
  const { data, draft, brand } = payload.snapshot;
  const report = <PublicProposal fullViewport data={data} draft={draft} brand={brand} initialPage={payload.initialPage}
    publicPath={payload.publicPath} exampleAgreement={payload.exampleAgreement} pdfHref={payload.pdfHref} attachments={payload.attachments} />;
  createRoot(root).render(<ReportBoundary>{payload.tracking
    ? <ProposalTracking token={payload.tracking.token} versionId={payload.tracking.versionId}>{report}</ProposalTracking> : report}</ReportBoundary>);
  // Do not let browser history restore an already-revoked, previously rendered report without a fresh request.
  window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
}
