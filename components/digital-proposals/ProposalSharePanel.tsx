"use client";

import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertCircle, Check, Copy, Download, ExternalLink, Eye, Globe, Link2Off, Loader2, RefreshCw } from "lucide-react";
import type { ProposalWorkspace, ProposalVersionSummary } from "@/lib/digital-proposals/workspace";
import { PDF_STATUS_POLL_DELAYS, currentProposalPublication, parsePublicationReceipt, publicationReceiptKey, proposalPublicationState, type PublicationConfirmation } from "@/lib/digital-proposals/shareState";
import { cn } from "@/lib/utils";
import { proposalFetch } from "./proposalFetch";

const subscribeOrigin = () => () => {};
const receiptChangedEvent = "staypack:proposal-publication-changed";
function subscribeReceipt(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(receiptChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(receiptChangedEvent, onChange);
  };
}
function readReceipt(editorPath: string) {
  try { return window.sessionStorage.getItem(publicationReceiptKey(editorPath)); }
  catch { return null; }
}
function storeReceipt(editorPath: string, confirmation: PublicationConfirmation) {
  try {
    window.sessionStorage.setItem(publicationReceiptKey(editorPath), JSON.stringify(confirmation));
    window.dispatchEvent(new Event(receiptChangedEvent));
  } catch { /* Storage can be unavailable; the current mounted panel still has the receipt. */ }
}

function publishedDate(value: string) {
  return new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" });
}

export function ProposalSharePanel({ reportId, workspace, onSave, onWorkspaceChange, valid, disabled = false, onBusyChange, hasUnsavedChanges = false, customerPanel, onPreviewDraft, previewingDraft = false, draftPreview }: {
  reportId: string; workspace: ProposalWorkspace; onSave: () => Promise<number | null>;
  onWorkspaceChange: (value: Partial<ProposalWorkspace>) => void; valid: boolean;
  disabled?: boolean; onBusyChange?: (busy: boolean) => void; hasUnsavedChanges?: boolean;
  customerPanel?: ReactNode; onPreviewDraft?: () => void; previewingDraft?: boolean; draftPreview?: ReactNode;
}) {
  const paths = useAppraisalRoutes(reportId);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [feedback, setFeedback] = useState<{ error: boolean; text: string; versionId?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PublicationConfirmation | null>(null);
  const receipt = useSyncExternalStore(subscribeReceipt, () => readReceipt(paths.editor), () => null);
  const [pollNotice, setPollNotice] = useState<{ versionId: string; text: string } | null>(null);
  const origin = useSyncExternalStore(subscribeOrigin, () => window.location.origin, () => "");
  const pending = useRef(false);
  const versions = useRef(workspace.versions);
  const workspaceChange = useRef(onWorkspaceChange);
  useEffect(() => { versions.current = workspace.versions; }, [workspace.versions]);
  useEffect(() => { workspaceChange.current = onWorkspaceChange; }, [onWorkspaceChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  const blocked = busy || disabled;
  const latest = currentProposalPublication(workspace);
  const history = workspace.versions.filter(version => version.id !== latest?.id);
  const publicationState = proposalPublicationState(workspace, latest, hasUnsavedChanges, confirmation ?? parsePublicationReceipt(receipt));
  const currentPublication = publicationState === "current";
  const latestId = latest?.id;
  const latestPath = latest?.path;
  const pdfWaiting = latest?.pdf_status === "pending" || latest?.pdf_status === "generating";

  useEffect(() => {
    if (!latestId || !pdfWaiting || blocked) return;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    async function checkStatus() {
      if (cancelled || pending.current) return;
      controller = new AbortController();
      try {
        const refreshed = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`, { signal: controller.signal });
        if (cancelled || pending.current) return;
        const observed = refreshed.versions.find(item => item.id === latestId);
        const next: ProposalVersionSummary[] = refreshed.versions.map(item => {
          const known = versions.current.find(version => version.id === item.id);
          return { ...known, ...item, pdf_status: known?.pdf_status === "ready" ? "ready" as const : item.pdf_status ?? known?.pdf_status };
        });
        next.push(...versions.current.filter(item => !next.some(version => version.id === item.id)));
        versions.current = next;
        workspaceChange.current({ versions: next, ...(refreshed.shareLink !== undefined ? { shareLink: refreshed.shareLink } : {}) });
        if (observed) {
          if (observed.path !== latestPath) setCopiedId(null);
          if (observed.revoked_at || observed.pdf_status === "ready" || observed.pdf_status === "failed") {
            if (observed.pdf_status === "ready" && !observed.revoked_at) setFeedback({ error: false, text: "The published version’s PDF is ready to download.", versionId: observed.id });
            return;
          }
        }
      } catch {
        if (cancelled) return;
      }
      attempt += 1;
      if (attempt < PDF_STATUS_POLL_DELAYS.length) timer = setTimeout(() => void checkStatus(), PDF_STATUS_POLL_DELAYS[attempt]);
      else setPollNotice({ versionId: latestId!, text: "Automatic checks have paused. Use the PDF button to check or retry; your published link is still available." });
    }
    timer = setTimeout(() => void checkStatus(), PDF_STATUS_POLL_DELAYS[0]);
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
  }, [latestId, latestPath, pdfWaiting, blocked, paths.api]);

  function updateVersions(next: ProposalVersionSummary[], refreshed?: ProposalWorkspace) {
    versions.current = next;
    onWorkspaceChange({ versions: next, ...(refreshed?.shareLink !== undefined ? { shareLink: refreshed.shareLink } : {}) });
  }
  async function run(action: () => Promise<void>) {
    if (disabled || pending.current) return;
    pending.current = true; setBusy(true); setFeedback(null); setPollNotice(null);
    try { await action(); }
    catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "Unable to complete this request. Please try again." }); }
    finally { pending.current = false; setBusy(false); setProgress(""); }
  }
  async function preparePdf(version: ProposalVersionSummary) {
    setPollNotice(null);
    setProgress(version.pdf_status === "generating" ? "Checking PDF status…" : "Preparing PDF…");
    try {
      const { status } = await proposalFetch<{ status: "ready" | "generating" }>(`${paths.api}/proposal/pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: version.id }),
      });
      const prepared = { ...version, pdf_status: status };
      updateVersions(versions.current.map(item => item.id === version.id ? { ...item, pdf_status: status } : item));
      // The preparation response is authoritative even when this optional refresh fails or lags.
      const refreshed = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`).catch(() => null);
      if (refreshed) {
        const next = refreshed.versions.map(item => item.id === version.id && status === "ready" ? { ...item, pdf_status: status } : item);
        updateVersions(next.some(item => item.id === version.id) ? next : [prepared, ...next], refreshed);
      }
      setFeedback({ error: false, versionId: version.id, text: versions.current.some(item => item.id === version.id && item.pdf_status === "ready")
        ? "The published version and its PDF are ready to share." : "Your published link is ready. The PDF is still being prepared; its status will update automatically." });
    } catch (error) {
      const refreshed = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`).catch(() => null);
      if (refreshed) {
        const retained = versions.current.find(item => item.id === version.id) ?? version;
        updateVersions(refreshed.versions.some(item => item.id === version.id) ? refreshed.versions : [retained, ...refreshed.versions], refreshed);
        const current = refreshed.versions.find(item => item.id === version.id);
        // A gateway response can fail while the server still finishes preparing the PDF.
        if (current && !current.revoked_at && (current.pdf_status === "ready" || current.pdf_status === "generating")) {
          setFeedback({ error: false, versionId: version.id, text: current.pdf_status === "ready"
            ? "The published version and its PDF are ready to share." : "Your published link is ready. The PDF is still being prepared; its status will update automatically." });
          return;
        }
      }
      throw error;
    }
  }
  function handlePreparePdf(version: ProposalVersionSummary) {
    void run(() => preparePdf(version));
  }
  async function publish() {
    if (!valid || currentPublication) return;
    await run(async () => {
      setProgress("Saving proposal…");
      const revision = await onSave();
      if (revision === null) { setFeedback({ error: true, text: "Your proposal has not been published. Resolve the draft changes and try again." }); return; }
      setProgress("Publishing proposal…");
      const { version, shareLink } = await proposalFetch<{ version: ProposalVersionSummary; shareLink?: ProposalWorkspace["shareLink"] }>(`${paths.api}/proposal/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, sourceFingerprint: workspace.sourceFingerprint }),
      });
      const next = [version, ...versions.current.filter(item => item.id !== version.id)];
      versions.current = next;
      onWorkspaceChange({ revision, versions: next, ...(shareLink !== undefined ? { shareLink } : {}) });
      const receipt = { versionId: version.id, path: shareLink?.path ?? version.path, revision, sourceFingerprint: workspace.sourceFingerprint };
      setConfirmation(receipt);
      storeReceipt(paths.editor, receipt);
      setRevokingId(null);
      if (version.pdf_status !== "ready") await preparePdf(version);
      else setFeedback({ error: false, versionId: version.id, text: "The published version and its PDF are ready to share." });
    });
  }
  async function copyLink(version: ProposalVersionSummary) {
    try {
      await navigator.clipboard.writeText(new URL(version.path, window.location.origin).href);
      setCopiedId(version.id); setFeedback({ error: false, versionId: version.id, text: version.id === latest?.id && currentPublication
        ? "Link copied. It’s ready to paste into your message."
        : "Published link copied. It includes this saved version; draft changes are not included." });
    } catch { setFeedback({ error: true, text: "Unable to copy automatically. Select the share link and copy it manually." }); }
  }
  async function revoke(version: ProposalVersionSummary) {
    await run(async () => {
      setProgress("Revoking access…");
      const { revokedAt } = await proposalFetch<{ revokedAt: string }>(`${paths.api}/proposal/revoke`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: version.id, linkId: version.link_id }),
      });
      const next = versions.current.map(item => (version.link_id ? item.link_id === version.link_id : item.id === version.id) ? { ...item, revoked_at: revokedAt } : item);
      versions.current = next;
      onWorkspaceChange({ versions: next, ...(workspace.shareLink && workspace.shareLink.id === version.link_id ? { shareLink: { ...workspace.shareLink, revoked_at: revokedAt } } : {}) });
      setRevokingId(null); setCopiedId(null);
      setFeedback({ error: false, text: "Link revoked. This version can no longer be opened with that link." });
    });
  }

  function feedbackMessage() {
    if (!feedback) return null;
    return <div role={feedback.error ? "alert" : "status"} className={cn("flex items-start gap-2 text-left text-sm", feedback.error ? "du-alert du-alert-error du-alert-soft" : "text-base-content/70")}>
      {feedback.error ? <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}<span className="min-w-0 break-words">{feedback.text}</span>
    </div>;
  }
  function revokeControls(version: ProposalVersionSummary) {
    return revokingId === version.id ? <div className="space-y-3">
      <p className="text-sm font-medium">{workspace.shareLink?.id === version.link_id && version.link_id ? "Stop sharing this proposal?" : "Stop sharing this version?"}</p>
      <p className="text-xs leading-relaxed text-base-content/65">This link will stop opening the proposal, its PDF and included documents. Other published links stay active.</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={blocked} className="du-btn du-btn-sm min-h-11" onClick={() => void revoke(version)}><Link2Off size={16} aria-hidden="true" />Revoke access</button><button type="button" disabled={blocked} className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => setRevokingId(null)}>Keep link</button></div>
    </div> : <button type="button" disabled={blocked} className="du-btn du-btn-sm du-btn-ghost min-h-11 text-base-content/65" onClick={() => setRevokingId(version.id)}><Link2Off size={15} aria-hidden="true" />Revoke link</button>;
  }
  function versionControls(version: ProposalVersionSummary, isCurrent: boolean, isLiveLink = false) {
    const pdfToken = /^\/proposal\/([a-f0-9]{64})(?:\?|$)/.exec(version.path)?.[1];
    const pdfPath = version.pdfPath ?? (pdfToken ? `/api/proposals/${pdfToken}/pdf` : undefined);
    const linkLabel = isCurrent || isLiveLink ? "Client share link" : "Previously published share link";
    const isLatest = version.id === latestId;
    return <div className="min-w-0 space-y-3">
      <div>
        <label htmlFor={`share-${version.id}`} className="mb-2 block text-xs font-medium text-base-content/65">{linkLabel}</label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <input id={`share-${version.id}`} aria-label={linkLabel} readOnly value={`${origin}${version.path}`} onFocus={event => event.currentTarget.select()} className="du-input du-input-sm min-h-12 w-full min-w-0 flex-1 text-xs" />
          <button type="button" disabled={blocked} className={cn("du-btn du-btn-sm min-h-12 shrink-0", isCurrent ? "du-btn-primary" : "du-btn-outline")} onClick={() => void copyLink(version)}>{copiedId === version.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copiedId === version.id ? "Link copied" : isCurrent ? "Copy link" : isLiveLink ? "Copy published link" : "Copy previous link"}</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className="du-btn du-btn-sm min-h-11" target="_blank" rel="noopener noreferrer" href={`${paths.editor}/preview?version=${version.id}`}><ExternalLink size={16} aria-hidden="true" />View published proposal</a>
        {version.pdf_status === "ready" && pdfPath ? <a className="du-btn du-btn-sm min-h-11" href={pdfPath} download><Download size={16} aria-hidden="true" />Download PDF</a> : <button type="button" disabled={blocked} className="du-btn du-btn-sm min-h-11" onClick={() => handlePreparePdf(version)}><RefreshCw size={16} aria-hidden="true" />{version.pdf_status === "generating" ? "Check PDF status" : version.pdf_status === "failed" ? "Retry PDF" : "Prepare PDF"}</button>}
      </div>
      {version.pdf_status === "failed" && <p className="text-xs text-base-content/65">Couldn’t prepare the PDF. Your link still works; try the PDF again.</p>}
      {isLatest && pdfWaiting && !busy && <p aria-live="polite" className="text-xs leading-relaxed text-base-content/65">{pollNotice?.versionId === version.id ? pollNotice.text : "Preparing the PDF. You can copy this published link while you wait."}</p>}
      {!isCurrent && feedback?.versionId === version.id && feedbackMessage()}
    </div>;
  }
  function previousVersion(version: ProposalVersionSummary) {
    return <li key={version.id} className="min-w-0 space-y-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-base-content/65">Published {publishedDate(version.created_at)}</p><span className="du-badge du-badge-sm du-badge-ghost">{version.revoked_at ? "Revoked" : "Active"}</span></div>
      {version.revoked_at ? <p className="text-xs text-base-content/60">Access ended {publishedDate(version.revoked_at)}.</p> : <>{versionControls(version, false)}{(!workspace.shareLink || version.link_id !== workspace.shareLink.id) && revokeControls(version)}</>}
    </li>;
  }
  const previousVersions = currentPublication || workspace.shareLink ? history : workspace.versions;
  const showGlobalFeedback = feedback && (!feedback.versionId || (currentPublication && feedback.versionId === latestId));
  return <section data-theme="staypack-workspace" aria-label="Publish and share proposal" className="du-card du-card-border min-w-0 bg-base-100 text-base-content">
    <div className="du-card-body min-w-0 gap-5 p-5 sm:p-6">
      {customerPanel && <div className="min-w-0 border-b border-base-300 pb-5">{customerPanel}</div>}
      <div className="space-y-2" aria-live="polite">
        <h2 className="du-card-title text-lg">{currentPublication ? "Ready to share" : publicationState === "changes" ? hasUnsavedChanges ? "Changes to publish" : "Changes ready to publish" : latest ? "Check before sharing" : "Publish your proposal"}</h2>
        <p className="text-sm leading-relaxed text-base-content/70">{currentPublication
          ? "Your link shows the latest published proposal."
          : publicationState === "changes"
            ? `${hasUnsavedChanges ? "Publishing saves your draft. " : "Your changes are saved privately. "}Publish to update the proposal at the same link.`
            : latest
              ? "An existing link is available, but we can’t confirm it includes your current draft."
              : "Publish when you’re ready for clients to view it."}</p>
      </div>
      {currentPublication && latest ? versionControls(latest, true) : <div className="space-y-3">
        <div className="du-card-actions gap-2">
          <button type="button" disabled={blocked || !valid} className="du-btn du-btn-sm du-btn-primary h-auto min-h-12 w-full whitespace-normal py-3 sm:w-auto" onClick={() => void publish()}>{busy ? <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : <Globe size={17} aria-hidden="true" />}{busy ? progress || "Working…" : latest ? "Update published proposal" : "Publish proposal"}</button>
          {onPreviewDraft && <button type="button" disabled={blocked} className="du-btn du-btn-sm min-h-12" onClick={onPreviewDraft}><Eye size={16} aria-hidden="true" />{previewingDraft ? "Close preview" : "Preview draft"}</button>}
        </div>
        {disabled ? <p className="text-xs text-base-content/65">Finish saving or editing your client details to continue.</p> : !valid && <p className="text-xs text-base-content/65">Review the proposal content before publishing.</p>}
        {latest && <p className="text-xs leading-relaxed text-base-content/65">Your share link stays the same. Previously downloaded PDFs won’t change.</p>}
      </div>}
      {busy && currentPublication && <p aria-live="polite" className="flex items-center gap-2 text-xs text-base-content/65"><Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />{progress || "Working…"}</p>}
      {showGlobalFeedback && feedbackMessage()}
      <p className="text-xs leading-relaxed text-base-content/65">Anyone with the link can view it until you revoke access. Nothing is sent automatically.</p>
      {!currentPublication && draftPreview}
      {(latest || previousVersions.length > 0) && <details key={`${currentPublication ? "current" : "previous"}:${latestId ?? "none"}`} className="du-collapse du-collapse-arrow min-w-0 rounded-none border-t border-base-300">
        <summary className="du-collapse-title min-h-11 py-3 pl-0 text-sm font-medium text-base-content/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{currentPublication ? "Link settings & history" : workspace.shareLink && latest ? "Published proposal & history" : previousVersions.length === 1 ? "Previous published version" : "Previous published versions"}</summary>
        <div className="du-collapse-content min-w-0 px-0">
          {!currentPublication && latest && workspace.shareLink && <div className="space-y-3 py-3"><p className="text-xs text-base-content/65">This link opens your published proposal. Draft changes aren’t included yet.</p>{versionControls(latest, false, true)}</div>}
          {latest && (currentPublication || workspace.shareLink) && <div className="space-y-2 pt-1"><p className="text-xs text-base-content/65">Published {publishedDate(workspace.shareLink?.updated_at ?? latest.created_at)}</p>{revokeControls(latest)}</div>}
          {!currentPublication && latest && <p className="text-xs leading-relaxed text-base-content/65">{publicationState === "changes" ? "These published versions do not include your draft changes." : "Check this published version before sharing; it may differ from your current draft."}</p>}
          {previousVersions.length > 0 && <ul className="min-w-0 divide-y divide-base-300">{previousVersions.map(previousVersion)}</ul>}
        </div>
      </details>}
    </div>
  </section>;
}
