"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Eye, Save } from "lucide-react";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { applyAssignment, assignmentBrand } from "@/lib/digital-proposals/assignment";
import { DEFAULT_PROPOSAL_DRAFT, validateProposalDraft, type ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { MultiPageProposal } from "./MultiPageProposal";
import { ProposalDocumentsEditor, ProposalPagesEditor, ProposalSharePanel, proposalFetch } from "./ProposalWorkspaceControls";
import { ProposalActivity } from "./ProposalActivity";
import { ProposalAgentPicker } from "./ProposalAgentPicker";
import { withProposalAgents } from "@/lib/digital-proposals/agents";

export type ProposalWorkflowHandle = { savePendingEdits: () => Promise<boolean> };
export const ProposalWorkflow = forwardRef<ProposalWorkflowHandle, {
  reportId: string; stage: "proposal" | "share"; disabled?: boolean; refreshKey?: string;
  onContinue?: () => void; onBusyChange?: (busy: boolean) => void;
}>(function ProposalWorkflow({ reportId, stage, disabled, refreshKey, onContinue, onBusyChange }, ref) {
  const [workspace, setWorkspace] = useState<ProposalWorkspace | null>(null);
  const sourceKey = `${reportId}:${refreshKey ?? ""}`;
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);
  const [section, setSection] = useState<"content" | "documents" | "preview">("content");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const loaded = useRef(false);
  const form = useForm<ProposalDraft>({ defaultValues: DEFAULT_PROPOSAL_DRAFT });
  const draft = useWatch({ control: form.control }) as ProposalDraft;
  const { reset } = form;
  useEffect(() => {
    let cancelled = false;
    void proposalFetch<ProposalWorkspace>(`/api/str/appraisals/${reportId}/proposal`).then(value => {
      if (cancelled) return;
      setWorkspace(value);
      setLoadedSourceKey(sourceKey);
      setLoadError(null);
      if (!loaded.current && value.assignment) { reset(applyAssignment(value.draft, value.assignment)); loaded.current = true; }
      setMessage("");
    }).catch(error => { if (!cancelled) setLoadError({ key: sourceKey, message: error.message }); });
    return () => { cancelled = true; };
  }, [reportId, sourceKey, reset]);
  async function save() {
    if (!workspace?.data || loadedSourceKey !== sourceKey || saving.current) return null;
    const validation = validateProposalDraft(form.getValues(), workspace.data);
    if (!validation.draft) { setMessage(validation.errors.join(" ")); return null; }
    saving.current = true; setBusy(true); onBusyChange?.(true); setMessage("");
    try {
      const saved = await proposalFetch<{ draft: ProposalDraft; revision: number }>(`/api/str/appraisals/${reportId}/proposal`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: validation.draft, revision: workspace.revision }),
      });
      reset(saved.draft); setWorkspace(current => current && ({ ...current, ...saved })); setMessage("Changes saved."); return saved.revision;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); return null; }
    finally { saving.current = false; setBusy(false); onBusyChange?.(false); }
  }
  useImperativeHandle(ref, () => ({ savePendingEdits: async () => (await save()) !== null }));
  const updateWorkspace = (change: Partial<ProposalWorkspace>) => setWorkspace(current => current && ({ ...current, ...change }));
  // A customer edit changes the publication fingerprint. Do not expose sharing
  // controls for the previous customer while the new workspace is loading.
  if (!workspace?.assignment || !workspace.data || !loaded.current || loadedSourceKey !== sourceKey) return <div role="status" className="p-6">{loadError?.key === sourceKey ? loadError.message : "Loading your proposal…"}</div>;
  const validation = validateProposalDraft(draft, workspace.data);
  const preview = <MultiPageProposal data={withProposalAgents(workspace.data, draft.agentIds ?? [], workspace.availableAgents ?? [])} draft={draft} brand={assignmentBrand(workspace.assignment)} previewPdfDownload
    attachments={workspace.attachments.filter(item => draft.attachmentIds.includes(item.id)).map(item => ({ ...item, href: `/api/str/appraisals/${reportId}/proposal/attachments/${item.id}` }))} />;
  return <section data-theme="staypack-workspace" className="min-w-0 space-y-5 text-base-content">
    <UnsavedListingGuard dirty={form.formState.isDirty} description="Your proposal has unsaved changes. Save them before leaving." />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{stage === "proposal" ? "Your proposal" : "Ready to share"}</h2><p className="mt-1 text-sm text-base-content/65">{workspace.assignment.name}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="du-btn du-btn-sm min-h-11" onClick={() => setSection(section === "preview" ? "content" : "preview")}><Eye size={16} />{section === "preview" ? "Close preview" : "Preview proposal"}</button>
        {stage === "proposal" && <button type="button" disabled={busy || disabled} className="du-btn du-btn-sm min-h-11" onClick={() => void save()}><Save size={16} />Save draft</button>}
      </div>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {stage === "proposal" && section !== "preview" && <>
      <div role="group" aria-label="Proposal editing" className="flex gap-2"><button type="button" aria-pressed={section === "content"} className="du-btn du-btn-sm min-h-11" onClick={() => setSection("content")}>Content</button><button type="button" aria-pressed={section === "documents"} className="du-btn du-btn-sm min-h-11" onClick={() => setSection("documents")}>Documents & links</button></div>
      <fieldset disabled={busy || disabled} className="min-w-0 rounded-xl border border-base-300 bg-base-100 p-5 sm:p-7">
        {section === "content" ? <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-5"><h3 className="font-semibold">Introduction</h3>
            <label className="block text-sm">Heading<input className="du-input du-input-sm mt-2 min-h-11 w-full" {...form.register("content.title")} /></label>
            <label className="block text-sm">Subtitle<input className="du-input du-input-sm mt-2 min-h-11 w-full" {...form.register("content.introduction")} /></label>
            <p className="text-xs text-base-content/65">Property and customer details fill in automatically.</p>
            <ProposalAgentPicker form={form} selected={draft.agentIds ?? []} agents={workspace.availableAgents ?? []} />
          </div><ProposalPagesEditor form={form} draft={draft} contentEditable={false} />
        </div> : <div className="max-w-2xl"><ProposalDocumentsEditor form={form} draft={draft} reportId={reportId} workspace={workspace} onWorkspaceChange={updateWorkspace} onBusyChange={value => { setBusy(value); onBusyChange?.(value); }} /></div>}
      </fieldset>
    </>}
    {section === "preview" && <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-base-300">{validation.draft ? preview : <p className="p-5">{validation.errors.join(" ")}</p>}</div>}
    {stage === "proposal" ? <div className="flex justify-end"><button type="button" className="du-btn du-btn-sm du-btn-primary min-h-12 w-full sm:w-auto" disabled={busy || disabled} onClick={onContinue}>Continue to customer & share</button></div> : <>
      <div className="rounded-xl border border-base-300 bg-base-100 p-5 sm:p-7"><ProposalSharePanel reportId={reportId} workspace={workspace} onSave={save} onWorkspaceChange={updateWorkspace} valid={Boolean(validation.draft) && !disabled} /></div>
      <ProposalActivity reportId={reportId} refreshKey={workspace.versions.map(item => item.id).join()} />
    </>}
  </section>;
});
