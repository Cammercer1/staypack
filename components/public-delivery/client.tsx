import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PublicProposal } from "@/components/digital-proposals/PublicProposal";
import { ProposalTracking } from "@/components/digital-proposals/ProposalTracking";
import type { PublicReportPayload } from "@/lib/public-delivery/payload";

class ReportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <ReportError /> : this.props.children;
  }
}
function ReportError() {
  return <main style={{ padding: 32 }} role="alert"><h1>This proposal could not be loaded.</h1><a href={location.href}>Try again</a></main>;
}

async function prepareStyles() {
  await Promise.all(Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-report-styles]")).map(link => new Promise<void>((resolve, reject) => {
    if (link.sheet) { link.media = "all"; resolve(); return; }
    const timer = window.setTimeout(() => reject(new Error("Viewer styles timed out")), 10000);
    link.addEventListener("load", () => { clearTimeout(timer); link.media = "all"; resolve(); }, { once: true });
    link.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Viewer styles unavailable")); }, { once: true });
  })));
}

const element = document.getElementById("public-report-data");
const root = document.getElementById("public-report-root");
async function mount() {
  if (!element || !root) return;
  await prepareStyles();
  const payload: PublicReportPayload = JSON.parse(element.textContent!);
  const { data, draft, brand } = payload.snapshot;
  const report = <PublicProposal fullViewport data={data} draft={draft} brand={brand} initialPage={payload.initialPage}
    publicPath={payload.publicPath} exampleAgreement={payload.exampleAgreement} pdfHref={payload.pdfHref} attachments={payload.attachments} />;
  createRoot(root).render(<ReportBoundary>{payload.tracking
    ? <ProposalTracking token={payload.tracking.token} versionId={payload.tracking.versionId}>{report}</ProposalTracking> : report}</ReportBoundary>);
  // Do not let browser history restore an already-revoked, previously rendered report without a fresh request.
  window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
}
void mount().catch(() => { if (root) createRoot(root).render(<ReportError />); });
