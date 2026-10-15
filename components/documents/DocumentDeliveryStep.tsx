"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";

export function DocumentDeliveryStep({
  name,
  disabled = false,
  preview,
  pdfReady,
  downloadUrl,
  publicUrl,
  published,
  hasLinkDraft,
  allowDraftPdf = false,
  linkPending,
  renderLinkEditor,
  onPreparePdf,
  onPublish,
  onEdit,
  onBusyChange,
  pdfProgressText,
}: {
  name: "appraisal" | "brochure";
  disabled?: boolean;
  pdfProgressText?: string;
  preview: ReactNode;
  pdfReady: boolean;
  downloadUrl: string;
  publicUrl?: string | null;
  published: boolean;
  hasLinkDraft: boolean;
  allowDraftPdf?: boolean;
  linkPending: boolean;
  renderLinkEditor: (busy: boolean) => ReactNode;
  onPreparePdf: () => Promise<void>;
  onPublish: () => Promise<void>;
  onEdit: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState<"pdf" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewId = useId();
  const urlId = useId();
  const pending = useRef(false);
  const copied = Boolean(publicUrl && copiedUrl === publicUrl);

  const blocked = disabled || Boolean(busy);
  const pdfNeedsPublication = hasLinkDraft && !allowDraftPdf;

  async function prepare(action: "pdf" | "publish") {
    if (
      blocked ||
      pending.current ||
      linkPending ||
      (action === "pdf" && pdfNeedsPublication)
    )
      return;
    pending.current = true;
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
      pending.current = false;
      setBusy(null);
      onBusyChange(false);
    }
  }

  async function copyLink() {
    if (blocked || !publicUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedUrl(publicUrl);
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
        description="Choose how to share your finished document. Download a PDF, publish a link, or both."
        status={
          <span className="du-badge du-badge-sm border-base-300 bg-base-200 text-base-content">
            {published ? "Published online" : "Private draft"}
          </span>
        }
      >
        <button
          type="button"
          className="du-btn du-btn-sm du-btn-ghost min-h-11"
          disabled={blocked}
          onClick={onEdit}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Edit {name === "brochure" ? "brochure" : "report"}
        </button>
        <button
          type="button"
          className="du-btn du-btn-sm du-btn-outline min-h-11"
          aria-expanded={showPreview}
          aria-controls={previewId}
          onClick={() => setShowPreview((visible) => !visible)}
        >
          <Eye className="size-4" aria-hidden="true" />
          {showPreview ? "Hide preview" : `Preview ${name}`}
          {showPreview ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>
      </DocumentStepHeader>
      {showPreview ? (
        <div
          id={previewId}
          className="min-w-0 rounded-2xl border border-base-300 bg-base-200 p-3 sm:p-5"
        >
          {preview}
        </div>
      ) : null}
      <div inert={disabled} className="space-y-4">
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="du-card du-card-border min-w-0 border-base-300 bg-base-100">
            <div className="du-card-body gap-5 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-base-200">
                  <Download className="size-5" aria-hidden="true" />
                </span>
                <h3 className="du-card-title text-base">Download PDF</h3>
              </div>
              <p className="text-sm text-base-content/65">
                A print-ready {name} with your branding and reviewed content. No
                online publication required.
              </p>
              {busy === "pdf" ? (
                <p role="status" className="flex gap-2 text-sm">
                  <Loader2
                    className="size-4 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                  {pdfProgressText ??
                    "Preparing your PDF. This can take 15–30 seconds…"}
                </p>
              ) : null}
              {pdfReady && !pdfNeedsPublication ? (
                <>
                  <p className="flex items-center gap-2 rounded-xl bg-success p-3 text-sm text-success-content">
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
                    disabled={blocked || linkPending}
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
                  disabled={blocked || linkPending || pdfNeedsPublication}
                  onClick={() => void prepare("pdf")}
                >
                  {busy === "pdf" ? "Preparing PDF…" : "Prepare PDF"}
                </button>
              )}
              {pdfNeedsPublication ? (
                <p className="text-xs text-base-content/65">
                  Publish your saved link / QR change below before preparing a
                  PDF.
                </p>
              ) : null}
              {linkPending ? (
                <p role="status" className="text-xs text-base-content/65">
                  Save or cancel your link changes to continue.
                </p>
              ) : null}
            </div>
          </section>
          <section className="du-card du-card-border min-w-0 border-base-300 bg-base-100">
            <div className="du-card-body gap-5 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-base-200">
                  <Globe className="size-5" aria-hidden="true" />
                </span>
                <h3 className="du-card-title text-base">Share online</h3>
                <span className="du-badge du-badge-sm">Optional</span>
              </div>
              <p className="text-sm text-base-content/65">
                Publish a link that anyone you share it with can open.
              </p>
              {publicUrl ? (
                <div className="space-y-3 rounded-xl border border-base-300 bg-base-200/45 p-4">
                  <label
                    htmlFor={urlId}
                    className="block text-xs font-semibold uppercase tracking-wide text-base-content/65"
                  >
                    Shareable link
                  </label>
                  <input
                    id={urlId}
                    aria-label="Shareable link"
                    readOnly
                    value={publicUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="du-input w-full min-w-0 border-base-300 bg-base-100 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="du-btn du-btn-sm min-h-11"
                      disabled={blocked}
                      onClick={() => void copyLink()}
                    >
                      {copied ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        <Copy className="size-4" aria-hidden="true" />
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
                  <p role="status" className="text-xs text-base-content/65">
                    {copied
                      ? "Link copied. Ready to paste into a message."
                      : "Anyone with this link can view the published document."}
                  </p>
                </div>
              ) : null}
              {renderLinkEditor(blocked)}
              <button
                type="button"
                className="du-btn du-btn-sm du-btn-outline min-h-11"
                disabled={blocked || linkPending}
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
        </div>
        {error ? (
          <p role="alert" className="du-alert du-alert-error text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
