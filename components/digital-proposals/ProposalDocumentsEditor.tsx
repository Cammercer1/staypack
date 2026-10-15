"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { AlertCircle, ArrowUpRight, Check, Download, FileSignature, FileText, Link2, Loader2, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { ProposalDraft } from "@/lib/digital-proposals/template";
import { isSafeProposalUrl } from "@/lib/digital-proposals/links";
import { MAX_PROPOSAL_PDF_BYTES, type ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { ProposalLinkDialog } from "./ProposalLinkDialog";
import { proposalFetch } from "./proposalFetch";
import { cn } from "@/lib/utils";

type ProposalLink = ProposalDraft["links"][number];
const MAX_INCLUDED_DOCUMENTS = 20;
const MAX_UPLOADED_DOCUMENTS = 50;
const MAX_LINKS = 12;

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function linkHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Update this link"; }
}

export function ProposalDocumentsEditor({ reportId, form, draft, workspace, onWorkspaceChange, onBusyChange, disabled = false }: {
  reportId?: string; form: UseFormReturn<ProposalDraft>; draft: ProposalDraft;
  workspace?: ProposalWorkspace; onWorkspaceChange: (value: Partial<ProposalWorkspace>) => void;
  onBusyChange?: (busy: boolean) => void; disabled?: boolean;
}) {
  const paths = useAppraisalRoutes(reportId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editor, setEditor] = useState<{ link: ProposalLink; editing: boolean } | null>(null);
  const [removed, setRemoved] = useState<{ link: ProposalLink; index: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  useEffect(() => () => { if (uploading.current) onBusyChange?.(false); }, [onBusyChange]);
  const dragDepth = useRef(0);
  const locked = disabled || busy;
  const attachments = workspace?.attachments ?? [];
  const canUpload = Boolean(workspace && reportId);
  const uploadLimit = attachments.length >= MAX_UPLOADED_DOCUMENTS || draft.attachmentIds.length >= MAX_INCLUDED_DOCUMENTS;
  const nextSteps = draft.pages.find(page => page.kind === "next_steps");
  const needsNextSteps = !nextSteps?.enabled && Boolean(draft.attachmentIds.length || draft.links.length || draft.agentIds.length);

  async function upload(file?: File) {
    if (!file || !workspace || !reportId || locked || uploading.current) return;
    if (workspace.attachments.length >= MAX_UPLOADED_DOCUMENTS) { setFeedback({ kind: "error", text: "This appraisal has reached its 50-document upload limit." }); return; }
    if (form.getValues("attachmentIds").length >= MAX_INCLUDED_DOCUMENTS) { setFeedback({ kind: "error", text: "You can include up to 20 documents. Turn one off before adding another." }); return; }
    if (file.type !== "application/pdf" || file.size === 0) { setFeedback({ kind: "error", text: "Choose a non-empty PDF document." }); return; }
    if (file.size > MAX_PROPOSAL_PDF_BYTES) { setFeedback({ kind: "error", text: "Choose a PDF of 4 MB or less." }); return; }
    uploading.current = true;
    setBusy(true); onBusyChange?.(true); setFeedback(null);
    try {
      const body = new FormData(); body.set("file", file);
      const { attachment } = await proposalFetch<{ attachment: ProposalWorkspace["attachments"][number] }>(`${paths.api}/proposal/attachments`, { method: "POST", body });
      onWorkspaceChange({ attachments: [...workspace.attachments.filter(item => item.id !== attachment.id), attachment] });
      form.setValue("attachmentIds", [...new Set([...form.getValues("attachmentIds"), attachment.id])], { shouldDirty: true });
      setFeedback({ kind: "success", text: `${attachment.name} uploaded and included.` });
    } catch (error) { setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Upload failed. Please try again." }); }
    finally { uploading.current = false; setBusy(false); onBusyChange?.(false); }
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); dragDepth.current = 0; setDragging(false);
    if (locked || !canUpload || uploading.current) return;
    if (event.dataTransfer.files.length !== 1) { setFeedback({ kind: "error", text: "Add one PDF at a time." }); return; }
    void upload(event.dataTransfer.files[0]);
  }
  function includeDocument(id: string, included: boolean) {
    if (locked) return;
    const ids = form.getValues("attachmentIds");
    if (included && (ids.includes(id) || ids.length >= MAX_INCLUDED_DOCUMENTS)) return;
    form.setValue("attachmentIds", included ? [...ids, id] : ids.filter(value => value !== id), { shouldDirty: true });
  }
  function saveLink(link: ProposalLink) {
    if (locked || !editor) return;
    const links = form.getValues("links");
    if (!editor.editing && links.length >= MAX_LINKS) return;
    form.setValue("links", editor.editing ? links.map(item => item.id === link.id ? link : item) : [...links, link], { shouldDirty: true });
    setEditor(null);
  }
  function removeLink(link: ProposalLink) {
    if (locked) return;
    const links = form.getValues("links");
    setRemoved({ link, index: links.findIndex(item => item.id === link.id) });
    form.setValue("links", links.filter(item => item.id !== link.id), { shouldDirty: true });
  }
  function undoRemoval() {
    if (locked || !removed) return;
    const links = [...form.getValues("links")];
    if (links.length >= MAX_LINKS || links.some(item => item.id === removed.link.id)) return;
    links.splice(Math.min(removed.index, links.length), 0, removed.link);
    form.setValue("links", links, { shouldDirty: true }); setRemoved(null);
  }

  return <div className="@container/proposal-documents min-w-0 space-y-5">
    {needsNextSteps && <div role="alert" className="du-alert du-alert-warning flex flex-wrap items-start gap-3 text-left">
      <AlertCircle size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="font-medium">Your Next steps page is hidden</p><p className="mt-1 text-xs leading-relaxed">Include it so your customer can access the documents, links and agents you’ve added.</p></div>
      {nextSteps && <button type="button" disabled={locked} className="du-btn du-btn-sm min-h-11" onClick={() => { const index = form.getValues("pages").findIndex(page => page.id === nextSteps.id); if (!locked && index >= 0) form.setValue(`pages.${index}.enabled`, true, { shouldDirty: true }); }}>Include Next steps</button>}
    </div>}

    <div className="grid min-w-0 items-start gap-5 @min-[800px]/proposal-documents:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section aria-label="Proposal documents" className="du-card du-card-border min-w-0 bg-base-100">
        <div className="du-card-body min-w-0 gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200"><Paperclip size={19} aria-hidden="true" /></span><div><h3 className="du-card-title text-base">Documents</h3><p className="mt-1 text-xs text-base-content/65">Helpful PDFs for your customer.</p></div></div>
            <span className="du-badge du-badge-sm du-badge-ghost shrink-0">{draft.attachmentIds.length} included</span>
          </div>

          <div role="region" aria-label="Upload a proposal document" onDragEnter={event => { event.preventDefault(); dragDepth.current++; if (!locked && canUpload && !uploadLimit) setDragging(true); }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = locked || !canUpload || uploadLimit ? "none" : "copy"; }} onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }} onDrop={dropFile}
            className={cn("flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "border-base-300 bg-base-200/30")}>
            <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-base-100 text-base-content/65">{busy ? <Loader2 size={21} className="motion-safe:animate-spin" aria-hidden="true" /> : <Upload size={21} aria-hidden="true" />}</span>
            <p className="text-sm font-medium">{busy ? "Uploading your document…" : dragging ? "Drop your PDF to upload" : "Drop a PDF here"}</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-base-content/60">{canUpload ? "Agreements, service guides or supporting information. Up to 4 MB per file." : "Open a saved appraisal to upload documents."}</p>
            <button type="button" disabled={locked || !canUpload || uploadLimit} className="du-btn du-btn-sm mt-4 min-h-11" onClick={() => fileInput.current?.click()}><Plus size={16} aria-hidden="true" />Choose PDF</button>
            <input ref={fileInput} className="hidden" type="file" accept="application/pdf,.pdf" aria-label="Upload PDF · up to 4 MB" disabled={locked || !canUpload || uploadLimit} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void upload(file); }} />
          </div>
          <div aria-live="polite" aria-atomic="true">
            {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg p-3 text-xs leading-relaxed", feedback.kind === "error" ? "bg-error/15 text-error-content" : "bg-success text-success-content")}>{feedback.kind === "error" ? <AlertCircle size={16} className="shrink-0" aria-hidden="true" /> : <Check size={16} className="shrink-0" aria-hidden="true" />}<span className="min-w-0 break-words">{feedback.text}</span></p>}
            {uploadLimit && <p className="mt-2 text-xs leading-relaxed text-base-content/65">{attachments.length >= MAX_UPLOADED_DOCUMENTS ? "This appraisal has reached its 50-document upload limit." : "20 documents included. Turn one off before adding another."}</p>}
          </div>

          {attachments.length ? <ul className="du-list max-h-[32rem] min-w-0 overflow-y-auto" aria-label="Uploaded documents">
            {attachments.map(item => {
              const included = draft.attachmentIds.includes(item.id);
              return <li key={item.id} className="du-list-row min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-none px-0 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-base-200 text-base-content/65"><FileText size={19} aria-hidden="true" /></span>
                <div className="min-w-0"><p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{item.name}</p><p className="mt-1 text-xs text-base-content/55">PDF · {fileSize(item.byte_size)}</p></div>
                <div className="du-list-col-wrap flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs has-disabled:cursor-default has-disabled:opacity-60"><input type="checkbox" className="du-toggle du-toggle-sm du-toggle-primary" aria-label={`Include ${item.name}`} disabled={locked || (!included && draft.attachmentIds.length >= MAX_INCLUDED_DOCUMENTS)} checked={included} onChange={event => includeDocument(item.id, event.target.checked)} />{included ? "Included in proposal" : "Not included"}</label>
                  {reportId && <a download={item.name} aria-label={`Download ${item.name}`} className="du-btn du-btn-sm du-btn-ghost min-h-11 gap-1.5 px-2 text-xs" href={`${paths.api}/proposal/attachments/${item.id}`}><Download size={14} aria-hidden="true" />Download</a>}
                </div>
              </li>;
            })}
          </ul> : <p className="text-center text-xs leading-relaxed text-base-content/55">Your uploaded documents will appear here.</p>}
          {attachments.length > 0 && <p className="border-t border-base-300 pt-4 text-xs leading-relaxed text-base-content/55">Turn a document off to leave it out of this proposal. It stays available here.</p>}
        </div>
      </section>

      <section aria-label="Proposal links" className="du-card du-card-border min-w-0 bg-base-100">
        <div className="du-card-body min-w-0 gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200"><Link2 size={19} aria-hidden="true" /></span><div><h3 className="du-card-title text-base">Action links</h3><p className="mt-1 text-xs text-base-content/65">Make the next step easy.</p></div></div>
            <span className="du-badge du-badge-sm du-badge-ghost shrink-0">{draft.links.length} / {MAX_LINKS}</span>
          </div>
          {draft.links.length ? <ul className="du-list min-w-0" aria-label="Added links">{draft.links.map(link => {
            const Icon = link.kind === "sign" ? FileSignature : Link2;
            return <li key={link.id} className="du-list-row min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-none px-0 py-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-base-200 text-base-content/65"><Icon size={18} aria-hidden="true" /></span>
              <div className="min-w-0"><p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{link.label}</p><p className="mt-1 break-words text-xs text-base-content/55 [overflow-wrap:anywhere]">{linkHost(link.url)}</p></div>
              <div className="du-list-col-wrap flex flex-wrap items-center justify-between gap-2">
                <span className="du-badge du-badge-sm du-badge-ghost">{link.kind === "sign" ? "Review & sign" : "Website or document"}</span>
                <div className="flex items-center">
                  {isSafeProposalUrl(link.url) && <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${link.label} (opens in a new tab)`} title="Open link" className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"><ArrowUpRight size={17} aria-hidden="true" /></a>}
                  <button type="button" aria-label={`Edit ${link.label}`} title="Edit link" disabled={locked} className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11" onClick={() => setEditor({ link, editing: true })}><Pencil size={16} aria-hidden="true" /></button>
                  <button type="button" aria-label={`Remove ${link.label}`} title="Remove link" disabled={locked} className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11 text-base-content/55 hover:text-error-content" onClick={() => removeLink(link)}><Trash2 size={16} aria-hidden="true" /></button>
                </div>
              </div>
            </li>;
          })}</ul> : <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-base-200/30 px-5 py-6 text-center"><Link2 size={26} className="mb-3 text-base-content/35" aria-hidden="true" /><p className="text-sm font-medium">Where should your customer go next?</p><p className="mt-2 max-w-xs text-xs leading-relaxed text-base-content/60">Add a signing link, your services page or another useful resource.</p></div>}
          <div className="du-card-actions">
            <button type="button" disabled={locked || draft.links.length >= MAX_LINKS} className="du-btn du-btn-sm min-h-11 w-full" onClick={() => { if (!locked && form.getValues("links").length < MAX_LINKS) setEditor({ link: { id: crypto.randomUUID(), label: "", kind: "link", url: "" }, editing: false }); }}><Plus size={16} aria-hidden="true" />Add link</button>
          </div>
          {removed && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-base-200/60 px-3 py-2 text-xs"><span className="min-w-0 break-words">“{removed.link.label}” removed.</span><button type="button" disabled={locked || draft.links.length >= MAX_LINKS} className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={undoRemoval}>Undo</button></div>}
          <p className="border-t border-base-300 pt-4 text-xs leading-relaxed text-base-content/55">These links appear as buttons on the Next steps page.</p>
        </div>
      </section>
    </div>
    {editor && <ProposalLinkDialog key={editor.link.id} link={editor.link} editing={editor.editing} disabled={locked} onSave={saveLink} onClose={() => setEditor(null)} />}
  </div>;
}
