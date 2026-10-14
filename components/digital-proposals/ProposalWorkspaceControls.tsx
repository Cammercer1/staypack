"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ArrowDown, ArrowUp, Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import type { ProposalDraft, ProposalPage } from "@/lib/digital-proposals/template";
import { MAX_PROPOSAL_PDF_BYTES, type ProposalWorkspace, type ProposalVersionSummary } from "@/lib/digital-proposals/workspace";

export async function proposalFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({ error: "Your session may have expired. Reload and try again." }));
  if (!response.ok || typeof body.error === "string") throw new Error(body.error ?? "Unable to complete this request.");
  return body as T;
}

export function ProposalPagesEditor({ form, draft, contentEditable = true }: { form: UseFormReturn<ProposalDraft>; draft: ProposalDraft; contentEditable?: boolean }) {
  const [editingId, setEditingId] = useState(draft.pages[0]?.id);
  const index = Math.max(0, draft.pages.findIndex(page => page.id === editingId));
  const page = draft.pages[index];
  function move(index: number, delta: number) {
    const pages = [...form.getValues("pages")];
    [pages[index], pages[index + delta]] = [pages[index + delta], pages[index]];
    form.setValue("pages", pages, { shouldDirty: true });
  }
  function addPage() {
    const id = `page-${crypto.randomUUID()}`;
    const page: ProposalPage = { id, kind: "text", title: "New page", body: "", enabled: true };
    form.setValue("pages", [...form.getValues("pages"), page], { shouldDirty: true }); setEditingId(id);
  }
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Proposal pages</h2>{contentEditable && <button className="du-btn du-btn-sm du-btn-ghost" type="button" disabled={draft.pages.length >= 12} onClick={addPage}><Plus size={15} />Add</button>}</div>
    <ol className="space-y-2">{draft.pages.map((item, i) => <li key={item.id} className="flex items-center gap-1 rounded-lg border border-base-300 p-2">
      <input type="checkbox" className="du-checkbox du-checkbox-sm shrink-0" aria-label={`Include ${item.title}`} disabled={!contentEditable && item.kind === "text" && !item.body.trim()} checked={item.enabled} onChange={event => form.setValue(`pages.${i}.enabled`, event.target.checked, { shouldDirty: true })} />
      {contentEditable ? <button type="button" aria-pressed={page?.id === item.id} className="min-w-0 flex-1 break-words px-2 py-2 text-left text-sm" onClick={() => setEditingId(item.id)}>{item.title}</button> : <span className="min-w-0 flex-1 break-words px-2 py-2 text-sm">{item.title}{item.kind === "text" && !item.body.trim() && <span className="block text-xs text-base-content/55">Not configured yet</span>}</span>}
      <button type="button" aria-label={`Move ${item.title} up`} disabled={i === 0} className="du-btn du-btn-sm du-btn-ghost du-btn-square" onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
      <button type="button" aria-label={`Move ${item.title} down`} disabled={i === draft.pages.length - 1} className="du-btn du-btn-sm du-btn-ghost du-btn-square" onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
    </li>)}</ol>
    {contentEditable && page && <div className="space-y-4 border-t border-base-300 pt-5" key={page.id}>
      <label className="block text-sm">Page title<input className="du-input du-input-sm mt-2 w-full" {...form.register(`pages.${index}.title`)} /></label>
      <label className="block text-sm">Page content<textarea className="du-textarea du-textarea-sm mt-2 min-h-48 w-full" placeholder="Tell the customer about your team, services or next steps. Data tokens work here too." {...form.register(`pages.${index}.body`)} /></label>
      <p className="text-xs">Use the checkbox to include a page in the proposal.</p>
      {page.id.startsWith("page-") && <button type="button" className="du-btn du-btn-sm du-btn-ghost" onClick={() => { form.setValue("pages", draft.pages.filter(item => item.id !== page.id), { shouldDirty: true }); setEditingId(draft.pages[0]?.id); }}><Trash2 size={14} />Remove page</button>}
    </div>}
  </div>;
}

export function ProposalDocumentsEditor({ reportId, form, draft, workspace, onWorkspaceChange, onBusyChange }: {
  reportId?: string; form: UseFormReturn<ProposalDraft>; draft: ProposalDraft;
  workspace?: ProposalWorkspace; onWorkspaceChange: (value: Partial<ProposalWorkspace>) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const paths = useAppraisalRoutes(reportId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(file?: File) {
    if (!file || !reportId || !workspace) return;
    if (file.size > MAX_PROPOSAL_PDF_BYTES) { setMessage("Choose a PDF under 4 MB."); return; }
    setBusy(true); onBusyChange?.(true); setMessage("");
    try {
      const body = new FormData(); body.set("file", file);
      const { attachment } = await proposalFetch<{ attachment: ProposalWorkspace["attachments"][number] }>(`${paths.api}/proposal/attachments`, { method: "POST", body });
      onWorkspaceChange({ attachments: [...workspace.attachments, attachment] });
      form.setValue("attachmentIds", [...form.getValues("attachmentIds"), attachment.id], { shouldDirty: true });
      setMessage("Document uploaded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <div className="space-y-6">
    <div><h2 className="font-semibold">Documents</h2><p className="mt-2 text-xs">PDFs appear on the Next steps page.</p></div>
    {workspace && reportId ? <>
      <label className="block text-sm"><span className="flex items-center gap-2"><Upload size={15} />Upload PDF · up to 4 MB</span><input type="file" accept="application/pdf" disabled={busy || workspace.attachments.length >= 50 || draft.attachmentIds.length >= 20} className="du-file-input du-file-input-sm mt-3 w-full" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <ul className="space-y-3">{workspace.attachments.map(item => <li key={item.id} className="flex items-start gap-2 text-sm"><input type="checkbox" aria-label={`Include ${item.name}`} checked={draft.attachmentIds.includes(item.id)} disabled={busy} onChange={event => form.setValue("attachmentIds", event.target.checked ? [...draft.attachmentIds, item.id] : draft.attachmentIds.filter(id => id !== item.id), { shouldDirty: true })} /><a download={item.name} className="break-all underline underline-offset-4" href={`${paths.api}/proposal/attachments/${item.id}`}>{item.name}</a></li>)}</ul>
      <p role="status" className="text-xs">{busy ? "Uploading document…" : message}</p>
    </> : <p className="text-sm">Open a saved appraisal to upload documents.</p>}
    <div className="border-t border-base-300 pt-5"><h2 className="font-semibold">Action links</h2><p className="mt-2 text-xs">Add a signing link or another next step.</p></div>
    {draft.links.map((link, index) => <div key={link.id} className="space-y-3 rounded-lg border border-base-300 p-3">
      <label className="block text-sm">Button label<input className="du-input du-input-sm mt-1 w-full" {...form.register(`links.${index}.label`)} /></label>
      <label className="block text-sm">Link URL<input type="url" placeholder="https://" className="du-input du-input-sm mt-1 w-full" {...form.register(`links.${index}.url`)} /></label>
      <label className="block text-sm">Link type<select className="du-select du-select-sm mt-1 w-full" {...form.register(`links.${index}.kind`)}><option value="link">Website or document</option><option value="sign">Review & sign</option></select></label>
      <button type="button" className="du-btn du-btn-sm du-btn-ghost" onClick={() => form.setValue("links", draft.links.filter(item => item.id !== link.id), { shouldDirty: true })}><Trash2 size={14} />Remove link</button>
    </div>)}
    <button type="button" disabled={draft.links.length >= 12} className="du-btn du-btn-sm w-full" onClick={() => form.setValue("links", [...draft.links, { id: crypto.randomUUID(), label: "Review & sign agreement", kind: "sign", url: "" }], { shouldDirty: true })}><Plus size={14} />Add link</button>
  </div>;
}

export function ProposalSharePanel({ reportId, workspace, onSave, onWorkspaceChange, valid }: {
  reportId: string; workspace: ProposalWorkspace; onSave: () => Promise<number | null>;
  onWorkspaceChange: (value: Partial<ProposalWorkspace>) => void; valid: boolean;
}) {
  const paths = useAppraisalRoutes(reportId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function preparePdf(version: ProposalVersionSummary) {
    setMessage("Proposal published. Preparing the PDF…");
    try {
      const { status } = await proposalFetch<{ status: "ready" | "generating" }>(`${paths.api}/proposal/pdf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: version.id }) });
      const refreshed = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`);
      onWorkspaceChange({ versions: refreshed.versions });
      setMessage(status === "ready" ? "Proposal and PDF ready to share." : "Your digital proposal is live. The PDF is being prepared.");
    } catch (error) {
      const refreshed = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`).catch(() => null);
      if (refreshed) onWorkspaceChange({ versions: refreshed.versions });
      setMessage(error instanceof Error ? error.message : "Your digital proposal is live. Retry the PDF below.");
    }
  }
  async function publish() {
    setBusy(true); setMessage("");
    try {
      const revision = await onSave();
      if (revision === null) return;
      const { version } = await proposalFetch<{ version: ProposalVersionSummary }>(`${paths.api}/proposal/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, sourceFingerprint: workspace.sourceFingerprint }) });
      onWorkspaceChange({ revision, versions: [version, ...workspace.versions.filter(item => item.id !== version.id)] });
      setMessage("Proposal published. Copy the link below to share it.");
      if (version.pdf_status !== "ready") await preparePdf(version);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Publishing failed."); }
    finally { setBusy(false); }
  }
  async function revoke(versionId: string) {
    setBusy(true);
    try {
      const { revokedAt } = await proposalFetch<{ revokedAt: string }>(`${paths.api}/proposal/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId, linkId: workspace.versions.find(item => item.id === versionId)?.link_id }) });
      onWorkspaceChange({ versions: workspace.versions.map(item => item.id === versionId ? { ...item, revoked_at: revokedAt } : item) }); setMessage("Share link revoked.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to revoke link."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <h2 className="font-semibold">Publish & share</h2>
    <p className="text-sm leading-relaxed">Create a fixed version for your customer. Anyone with its link can view the proposal and included documents until you revoke it.</p>
    <button type="button" disabled={busy || !valid} className="du-btn du-btn-sm du-btn-primary min-h-12 w-full" onClick={() => void publish()}>{busy ? "Working…" : "Publish proposal"}</button>
    <p role="status" className="text-sm">{message}</p>
    {workspace.versions.map(version => <div key={version.id} className="space-y-3 border-t border-base-300 pt-4 text-sm">
      <div className="flex justify-between gap-2"><strong>Published proposal</strong><span>{version.revoked_at ? "Revoked" : "Active"}</span></div>
      <p className="text-xs">{new Date(version.created_at).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}</p>
      {!version.revoked_at && <div className="flex flex-wrap gap-2"><a className="du-btn du-btn-sm" target="_blank" rel="noreferrer" href={`${paths.editor}/preview?version=${version.id}`}>Preview</a><button type="button" className="du-btn du-btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(new URL(version.path, window.location.origin).href); setMessage("Link copied."); } catch { setMessage(`Copy this link: ${new URL(version.path, window.location.origin).href}`); } }}><Copy size={14} />Copy link</button><button type="button" disabled={busy} className="du-btn du-btn-sm du-btn-ghost" onClick={() => void revoke(version.id)}>Revoke link</button>{version.pdf_status === "ready" && <a className="du-btn du-btn-sm" download href={`${version.path.replace(/^\/proposal\//, "/api/proposals/")}/pdf`}><Download size={14} />Download appraisal PDF</a>}{version.pdf_status !== "ready" && <button type="button" disabled={busy} className="du-btn du-btn-sm" onClick={() => { setBusy(true); void preparePdf(version).finally(() => setBusy(false)); }}>{version.pdf_status === "failed" ? "Retry PDF" : "Prepare PDF"}</button>}</div>}
    </div>)}
  </div>;
}
