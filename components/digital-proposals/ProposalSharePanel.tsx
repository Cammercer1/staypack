"use client";

import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, Copy, Download, ExternalLink, FileText, Globe, History, Link2, Link2Off, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { ProposalWorkspace, ProposalVersionSummary } from "@/lib/digital-proposals/workspace";
import { cn } from "@/lib/utils";
import { proposalFetch } from "./proposalFetch";

const subscribeOrigin = () => () => {};

function publishedDate(value: string) {
  return new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" });
}

export function ProposalSharePanel({ reportId, workspace, onSave, onWorkspaceChange, valid, disabled = false, onBusyChange }: {
  reportId: string; workspace: ProposalWorkspace; onSave: () => Promise<number | null>;
  onWorkspaceChange: (value: Partial<ProposalWorkspace>) => void; valid: boolean;
  disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const paths = useAppraisalRoutes(reportId);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const origin = useSyncExternalStore(subscribeOrigin, () => window.location.origin, () => "");
  const pending = useRef(false);
  const versions = useRef(workspace.versions);
  useEffect(() => { versions.current = workspace.versions; }, [workspace.versions]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  const blocked = busy || disabled;
  const latest = workspace.versions.find(version => !version.revoked_at);
  const history = workspace.versions.filter(version => version.id !== latest?.id);

  function updateVersions(next: ProposalVersionSummary[]) {
    versions.current = next;
    onWorkspaceChange({ versions: next });
  }
  async function run(action: () => Promise<void>) {
    if (disabled || pending.current) return;
    pending.current = true; setBusy(true); setFeedback(null);
    try { await action(); }
    catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "Unable to complete this request. Please try again." }); }
    finally { pending.current = false; setBusy(false); setProgress(""); }
  }
  async function preparePdf(version: ProposalVersionSummary) {
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
        updateVersions(next.some(item => item.id === version.id) ? next : [prepared, ...next]);
      }
      setFeedback({ error: false, text: versions.current.some(item => item.id === version.id && item.pdf_status === "ready")
        ? "Your proposal and PDF are ready to share." : "Your link is ready. The PDF is still being prepared; check its status below." });
    } catch (error) {
      const refreshed = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`).catch(() => null);
      if (refreshed) {
        const retained = versions.current.find(item => item.id === version.id) ?? version;
        updateVersions(refreshed.versions.some(item => item.id === version.id) ? refreshed.versions : [retained, ...refreshed.versions]);
      }
      throw error;
    }
  }
  async function publish() {
    if (!valid) return;
    await run(async () => {
      setProgress("Saving proposal…");
      const revision = await onSave();
      if (revision === null) { setFeedback({ error: true, text: "Your proposal has not been published. Resolve the draft changes and try again." }); return; }
      setProgress("Publishing proposal…");
      const { version } = await proposalFetch<{ version: ProposalVersionSummary }>(`${paths.api}/proposal/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, sourceFingerprint: workspace.sourceFingerprint }),
      });
      const next = [version, ...versions.current.filter(item => item.id !== version.id)];
      versions.current = next;
      onWorkspaceChange({ revision, versions: next });
      setRevokingId(null);
      if (version.pdf_status !== "ready") await preparePdf(version);
      else setFeedback({ error: false, text: "Your proposal and PDF are ready to share." });
    });
  }
  async function copyLink(version: ProposalVersionSummary) {
    try {
      await navigator.clipboard.writeText(new URL(version.path, window.location.origin).href);
      setCopiedId(version.id); setFeedback({ error: false, text: "Link copied. It’s ready to paste into your message." });
    } catch { setFeedback({ error: true, text: "Unable to copy automatically. Select and copy the share link below." }); }
  }
  async function revoke(version: ProposalVersionSummary) {
    await run(async () => {
      setProgress("Revoking access…");
      const { revokedAt } = await proposalFetch<{ revokedAt: string }>(`${paths.api}/proposal/revoke`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: version.id, linkId: version.link_id }),
      });
      updateVersions(versions.current.map(item => item.id === version.id ? { ...item, revoked_at: revokedAt } : item));
      setRevokingId(null); setCopiedId(null);
      setFeedback({ error: false, text: "Link revoked. This version can no longer be opened with that link." });
    });
  }

  function versionControls(version: ProposalVersionSummary, current: boolean) {
    const pdfToken = /^\/proposal\/([a-f0-9]{64})$/.exec(version.path)?.[1];
    return <div className="min-w-0 space-y-4">
      <div>
        <label htmlFor={`share-${version.id}`} className="mb-2 block text-xs font-medium text-base-content/65">{current ? "Customer share link" : "Share link for this version"}</label>
        <input id={`share-${version.id}`} aria-label={current ? "Customer share link" : "Share link for this version"} readOnly value={`${origin}${version.path}`} onFocus={event => event.currentTarget.select()} className="du-input du-input-sm min-h-11 w-full min-w-0 text-xs" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={disabled} className={cn("du-btn du-btn-sm min-h-11", current ? "du-btn-primary" : "du-btn-outline")} onClick={() => void copyLink(version)}>{copiedId === version.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copiedId === version.id ? "Link copied" : "Copy link"}</button>
          <a className="du-btn du-btn-sm du-btn-ghost min-h-11" target="_blank" rel="noopener noreferrer" href={`${paths.editor}/preview?version=${version.id}`}><ExternalLink size={16} aria-hidden="true" />Preview published version</a>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-base-200/50 p-4">
        <div className="flex min-w-0 items-center gap-3"><FileText size={19} className="shrink-0 text-base-content/60" aria-hidden="true" /><div><p className="text-sm font-medium">Proposal PDF</p><p className="mt-1 text-xs text-base-content/60">{version.pdf_status === "ready" ? "Ready to download" : version.pdf_status === "generating" ? "Being prepared" : version.pdf_status === "failed" ? "Couldn’t prepare the PDF. Try again." : "Prepare a copy to download"}</p></div></div>
        {version.pdf_status === "ready" && pdfToken ? <a className="du-btn du-btn-sm min-h-11" href={`/api/proposals/${pdfToken}/pdf`} download><Download size={16} aria-hidden="true" />Download PDF</a> : <button type="button" disabled={blocked} className="du-btn du-btn-sm min-h-11" onClick={() => void run(() => preparePdf(version))}><RefreshCw size={16} aria-hidden="true" />{version.pdf_status === "generating" ? "Check PDF status" : version.pdf_status === "failed" ? "Retry PDF" : "Prepare PDF"}</button>}
      </div>
      {revokingId === version.id ? <div className="rounded-xl border border-base-300 p-4"><p className="text-sm font-medium">Stop sharing this version?</p><p className="mt-1 text-xs leading-relaxed text-base-content/65">This link will stop opening the proposal, its PDF and included documents. Other published links stay active.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={blocked} className="du-btn du-btn-sm min-h-11" onClick={() => void revoke(version)}><Link2Off size={16} aria-hidden="true" />Revoke access</button><button type="button" disabled={blocked} className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => setRevokingId(null)}>Keep link</button></div></div> : <button type="button" disabled={blocked} className="du-btn du-btn-sm du-btn-ghost min-h-11 text-base-content/60" onClick={() => setRevokingId(version.id)}><Link2Off size={15} aria-hidden="true" />Revoke link</button>}
    </div>;
  }

  return <section data-theme="staypack-workspace" aria-label="Publish and share proposal" className="du-card du-card-border min-w-0 bg-base-100 text-base-content">
    <div className="du-card-body min-w-0 gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200"><Globe size={20} aria-hidden="true" /></span><div><h2 className="du-card-title text-base">Share proposal</h2><p className="mt-1 text-xs text-base-content/65">A polished link, ready for your customer.</p></div></div><span className="du-badge du-badge-sm du-badge-ghost">{latest ? "Published" : "Private draft"}</span></div>
      {latest ? <div className="min-w-0 space-y-5"><div className="flex items-start gap-2 text-sm"><Check size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div><p className="font-medium">Your latest published version</p><p className="mt-1 text-xs text-base-content/60">Published {publishedDate(latest.created_at)}</p></div></div>{versionControls(latest, true)}</div> : <div className="rounded-xl bg-base-200/40 px-5 py-6"><Link2 size={25} className="mb-3 text-base-content/55" aria-hidden="true" /><h3 className="text-base font-medium">Create your customer’s share link</h3><p className="mt-2 text-sm leading-relaxed text-base-content/65">Publish the proposal to create a link and prepare a PDF. You can then copy the link into your own email or message.</p></div>}
      {feedback && <div role={feedback.error ? "alert" : "status"} className={cn("du-alert flex items-start gap-2 text-left text-sm", feedback.error ? "du-alert-error" : "du-alert-success")}>{feedback.error ? <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}<span className="min-w-0 break-words">{feedback.text}</span></div>}
      <div className={cn("space-y-3", latest && "border-t border-base-300 pt-5")}>
        {latest && <p className="text-xs leading-relaxed text-base-content/65">Made changes? Publish again to create a link with your latest proposal. Existing links keep their saved content.</p>}
        <button type="button" disabled={blocked || !valid} className={cn("du-btn du-btn-sm min-h-12 w-full", latest ? "du-btn-outline" : "du-btn-primary")} onClick={() => void publish()}>{busy ? <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : <Globe size={17} aria-hidden="true" />}{busy ? progress || "Working…" : latest ? "Publish latest changes" : "Publish proposal"}</button>
        {disabled ? <p className="text-xs text-base-content/65">Finish saving or editing your customer details to continue.</p> : !valid && <p className="text-xs text-base-content/65">Review the proposal content before publishing.</p>}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-base-content/60"><ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Anyone with the link can view this version until you revoke it. Publishing does not send a message.</span></p>
      </div>
      {history.length > 0 && <details className="min-w-0 border-t border-base-300 pt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><History size={16} className="mr-2 inline-block" aria-hidden="true" />Previous versions <span className="ml-1 text-base-content/55">({history.length})</span></summary><ul className="du-list min-w-0">{history.map(version => <li key={version.id} className="du-list-row block min-w-0 space-y-4 rounded-none px-0 py-5"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs text-base-content/65">Published {publishedDate(version.created_at)}</p><span className="du-badge du-badge-sm du-badge-ghost">{version.revoked_at ? "Revoked" : "Active"}</span></div>{version.revoked_at ? <p className="text-xs text-base-content/60">Access ended {publishedDate(version.revoked_at)}.</p> : versionControls(version, false)}</li>)}</ul></details>}
    </div>
  </section>;
}
