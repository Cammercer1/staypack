"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";

export function DocumentDeliveryStep({
  name,
  preview,
  pdfReady,
  downloadUrl,
  publicUrl,
  published,
  hasLinkDraft,
  linkPending,
  renderLinkEditor,
  onPreparePdf,
  onPublish,
  onEdit,
  onBusyChange,
}: {
  name: "appraisal" | "brochure";
  preview: ReactNode;
  pdfReady: boolean;
  downloadUrl: string;
  publicUrl?: string | null;
  published: boolean;
  hasLinkDraft: boolean;
  linkPending: boolean;
  renderLinkEditor: (busy: boolean) => ReactNode;
  onPreparePdf: () => Promise<void>;
  onPublish: () => Promise<void>;
  onEdit: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState<"pdf" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function prepare(action: "pdf" | "publish") {
    if (busy) return;
    setBusy(action);
    onBusyChange(true);
    setError(null);
    try {
      await (action === "pdf" ? onPreparePdf() : onPublish());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(null);
      onBusyChange(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl!);
      setCopied(true);
    } catch {
      setError(
        "Unable to copy the link. Open the online report and copy its address.",
      );
    }
  }

  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title={`Your ${name}, ready to share`}
        description="Review the document, then prepare a PDF or publish a shareable online version."
        status={
          <span className="du-badge du-badge-sm">
            {published ? "Published online" : "Private draft"}
          </span>
        }
      >
        <button
          type="button"
          className="du-btn du-btn-sm du-btn-outline min-h-11"
          disabled={Boolean(busy)}
          onClick={onEdit}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Edit {name === "brochure" ? "brochure" : "report"}
        </button>
      </DocumentStepHeader>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">{preview}</div>
        <aside className="order-first space-y-4 xl:order-last xl:sticky xl:top-32">
          <section className="du-card du-card-border bg-base-100">
            <div className="du-card-body gap-4 p-5">
              <div className="flex items-center gap-3">
                <Download className="size-5" aria-hidden="true" />
                <h3 className="du-card-title text-base">Download PDF</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                A print-ready {name} with your branding and reviewed content. No
                online publication required.
              </p>
              {busy === "pdf" ? (
                <p role="status" className="flex gap-2 text-sm">
                  <Loader2
                    className="size-4 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                  Preparing your PDF. This can take 15–30 seconds…
                </p>
              ) : null}
              {pdfReady && !hasLinkDraft ? (
                <>
                  <p className="flex items-center gap-2 text-sm">
                    <Check className="size-4" aria-hidden="true" />
                    PDF ready
                  </p>
                  <a
                    className="du-btn du-btn-sm du-btn-primary min-h-11"
                    href={downloadUrl}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Download PDF
                  </a>
                  <button
                    type="button"
                    className="du-btn du-btn-sm du-btn-ghost min-h-11"
                    disabled={Boolean(busy) || linkPending}
                    onClick={() => void prepare("pdf")}
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Prepare again
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="du-btn du-btn-sm du-btn-primary min-h-11"
                  disabled={Boolean(busy) || linkPending || hasLinkDraft}
                  onClick={() => void prepare("pdf")}
                >
                  {busy === "pdf" ? "Preparing PDF…" : "Prepare PDF"}
                </button>
              )}
              {hasLinkDraft ? (
                <p className="text-xs text-muted-foreground">
                  Publish your saved link / QR change below before preparing a
                  PDF.
                </p>
              ) : null}
              {linkPending ? (
                <p role="status" className="text-xs text-muted-foreground">
                  Save your link settings below to continue.
                </p>
              ) : null}
            </div>
          </section>
          <section className="du-card du-card-border bg-base-100">
            <div className="du-card-body gap-4 p-5">
              <div className="flex items-center gap-3">
                <Globe className="size-5" aria-hidden="true" />
                <h3 className="du-card-title text-base">Share online</h3>
                <span className="du-badge du-badge-sm">Optional</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Publish a link that anyone you share it with can open.
              </p>
              {publicUrl ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="du-btn du-btn-sm min-h-11"
                    onClick={() => void copyLink()}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied ? "Link copied" : "Copy link"}
                  </button>
                  <a
                    className="du-btn du-btn-sm du-btn-ghost min-h-11"
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </div>
              ) : null}
              {renderLinkEditor(Boolean(busy))}
              <button
                type="button"
                className="du-btn du-btn-sm du-btn-outline min-h-11"
                disabled={Boolean(busy) || linkPending}
                onClick={() => void prepare("publish")}
              >
                {busy === "publish" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {busy === "publish"
                  ? "Publishing…"
                  : published
                    ? `Update online ${name === "brochure" ? "brochure" : "report"}`
                    : `Publish online ${name === "brochure" ? "brochure" : "report"}`}
              </button>
            </div>
          </section>
          {error ? (
            <p
              role="alert"
              className="du-alert du-alert-error du-alert-soft text-sm"
            >
              {error}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
