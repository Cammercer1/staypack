"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowRight, Eye, LayoutList, Paperclip, Save } from "lucide-react";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { applyAssignment, assignmentBrand } from "@/lib/digital-proposals/assignment";
import { DEFAULT_PROPOSAL_DRAFT, validateProposalDraft, type ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { MultiPageProposal } from "./MultiPageProposal";
import { ProposalDocumentsEditor, ProposalPagesEditor, ProposalSharePanel, proposalFetch } from "./ProposalWorkspaceControls";
import { ProposalActivity } from "./ProposalActivity";
import { ProposalAgentPicker } from "./ProposalAgentPicker";
import { withProposalAgents } from "@/lib/digital-proposals/agents";
import { ProposalCoverSummary } from "./ProposalCoverSummary";
import { cn } from "@/lib/utils";

export type ProposalWorkflowHandle = { savePendingEdits: () => Promise<boolean> };
export const ProposalWorkflow = forwardRef<ProposalWorkflowHandle, {
  reportId: string; stage: "proposal" | "share"; disabled?: boolean; refreshKey?: string;
  customerPanel?: ReactNode;
  onContinue?: () => void; onBusyChange?: (busy: boolean) => void;
}>(function ProposalWorkflow({ reportId, stage, disabled, refreshKey, customerPanel, onContinue, onBusyChange }, ref) {
  const paths = useAppraisalRoutes(reportId);
  const [workspace, setWorkspace] = useState<ProposalWorkspace | null>(null);
  const sourceKey = `${reportId}:${refreshKey ?? ""}`;
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);
  const [section, setSection] = useState<"content" | "documents" | "preview">("content");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => { onBusyChange?.(busy || sharing); }, [busy, sharing, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const saving = useRef(false);
  const loaded = useRef(false);
  const form = useForm<ProposalDraft>({ defaultValues: DEFAULT_PROPOSAL_DRAFT });
  const draft = useWatch({ control: form.control }) as ProposalDraft;
  const { reset } = form;
  useEffect(() => {
    let cancelled = false;
    void proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`).then(value => {
      if (cancelled) return;
      setWorkspace(value);
      setLoadedSourceKey(sourceKey);
      setLoadError(null);
      if (!loaded.current && value.assignment) { reset(applyAssignment(value.draft, value.assignment)); loaded.current = true; }
      setMessage("");
    }).catch(error => { if (!cancelled) setLoadError({ key: sourceKey, message: error.message }); });
    return () => { cancelled = true; };
  }, [reportId, sourceKey, reset, paths.api]);
  async function save() {
    if (!workspace?.data || loadedSourceKey !== sourceKey || saving.current) return null;
    const validation = validateProposalDraft(form.getValues(), workspace.data);
    if (!validation.draft) { setMessage(validation.errors.join(" ")); return null; }
    saving.current = true; setBusy(true); setMessage("");
    try {
      const saved = await proposalFetch<{ draft: ProposalDraft; revision: number }>(`${paths.api}/proposal`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: validation.draft, revision: workspace.revision }),
      });
      reset(saved.draft); setWorkspace(current => current && ({ ...current, ...saved })); setMessage("Changes saved."); return saved.revision;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); return null; }
    finally { saving.current = false; setBusy(false); }
  }
  useImperativeHandle(ref, () => ({ savePendingEdits: async () => (await save()) !== null }));
  const updateWorkspace = (change: Partial<ProposalWorkspace>) => setWorkspace(current => current && ({ ...current, ...change }));
  // A customer edit changes the publication fingerprint. Do not expose sharing
  // controls for the previous customer while the new workspace is loading.
  if (!workspace?.assignment || !workspace.data || !loaded.current || loadedSourceKey !== sourceKey) return <div role="status" className="p-6">{loadError?.key === sourceKey ? loadError.message : "Loading your proposal…"}</div>;
  const validation = validateProposalDraft(draft, workspace.data);
  const previewData = withProposalAgents(workspace.data, draft.agentIds ?? [], workspace.availableAgents ?? []);
  const preview = <MultiPageProposal data={previewData} draft={draft} brand={assignmentBrand(workspace.assignment)} previewPdfDownload
    attachments={workspace.attachments.filter(item => draft.attachmentIds.includes(item.id)).map(item => ({ ...item, href: `${paths.api}/proposal/attachments/${item.id}` }))} />;
  return <section data-theme="staypack-workspace" className="min-w-0 space-y-5 text-base-content">
    <UnsavedListingGuard dirty={form.formState.isDirty} description="Your proposal has unsaved changes. Save them before leaving." />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{stage === "proposal" ? "Your proposal" : "Review & share"}</h2><p className="mt-1 text-sm text-base-content/65">{stage === "proposal" ? "Choose your agents and arrange the pages your client will see." : "Check your client details, then publish and share your proposal."}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || sharing || disabled} className="du-btn du-btn-sm min-h-11" onClick={() => setSection(section === "preview" ? "content" : "preview")}><Eye size={16} aria-hidden="true" />{section === "preview" ? "Close preview" : "Preview proposal"}</button>
        {stage === "proposal" && <button type="button" disabled={busy || disabled} className="du-btn du-btn-sm min-h-11" onClick={() => void save()}><Save size={16} />Save draft</button>}
      </div>
    </div>
    {workspace.needsEvidenceReview && <p role="status" className="du-alert du-alert-warning">Evidence has changed. Return to Review evidence and continue to proposal before publishing a new version. Existing links still show their saved version.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {stage === "proposal" && section !== "preview" && <>
      <div role="group" aria-label="Proposal editing" className="flex w-fit max-w-full gap-1 rounded-xl border border-base-300 bg-base-200/60 p-1">
        {([{ id: "content", label: "Content", Icon: LayoutList }, { id: "documents", label: "Documents & links", Icon: Paperclip }] as const).map(({ id, label, Icon }) => <button key={id} type="button" disabled={busy || disabled} aria-pressed={section === id} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4", section === id ? "bg-base-100 text-base-content shadow-sm" : "text-base-content/60 hover:text-base-content")} onClick={() => setSection(id)}><Icon size={15} aria-hidden="true" />{label}</button>)}
      </div>
      <fieldset disabled={busy || disabled} className="min-w-0">
        {section === "content" ? <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
          <div className="min-w-0 space-y-5">
            <ProposalCoverSummary data={previewData} draft={applyAssignment(draft, workspace.assignment)} />
            <ProposalAgentPicker form={form} selected={draft.agentIds ?? []} agents={workspace.availableAgents ?? []} disabled={busy || disabled} />
          </div>
          <div className="min-w-0 rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6"><ProposalPagesEditor form={form} draft={draft} contentEditable={false} disabled={busy || disabled} /></div>
        </div> : <ProposalDocumentsEditor form={form} draft={draft} reportId={reportId} workspace={workspace} onWorkspaceChange={updateWorkspace} disabled={busy || disabled} onBusyChange={setBusy} />}
      </fieldset>
    </>}
    {section === "preview" && <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-base-300">{validation.draft ? preview : <p className="p-5">{validation.errors.join(" ")}</p>}</div>}
    {stage === "proposal" ? <div className="flex justify-end border-t border-base-300 pt-5"><button type="button" className="du-btn du-btn-sm du-btn-primary min-h-12 w-full sm:w-auto" disabled={busy || disabled} onClick={onContinue}>Continue to customer & share<ArrowRight size={16} aria-hidden="true" /></button></div> : section !== "preview" && <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:grid-rows-[auto_1fr]">
      {customerPanel && <div className="min-w-0 lg:col-start-1 lg:row-start-1">{customerPanel}</div>}
      <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1"><ProposalSharePanel reportId={reportId} workspace={workspace} onSave={save} onWorkspaceChange={updateWorkspace} valid={Boolean(validation.draft) && !disabled && !workspace.needsEvidenceReview} disabled={disabled || busy} onBusyChange={setSharing} /></div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2"><ProposalActivity reportId={reportId} refreshKey={workspace.versions.map(item => `${item.id}:${item.revoked_at ?? "active"}`).join()} /></div>
    </div>}
  </section>;
});
