"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { AppraisalStepPanel, AppraisalStepTabs } from "@/components/appraisals/AppraisalStepTabs";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowRight, Eye, LayoutList, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { ProposalPhotoPicker } from "./ProposalPhotoPicker";
import { withProposalPhotos, type ProposalPhotoSelection } from "@/lib/digital-proposals/photos";
import { createProposalDraftSaver, mergeSavedProposalDraft, PROPOSAL_AUTOSAVE_DELAY, type SavedProposalDraft } from "./proposalDraftSaver";

export type ProposalWorkflowHandle = { savePendingEdits: () => Promise<boolean> };
export const ProposalWorkflow = forwardRef<ProposalWorkflowHandle, {
  reportId: string; stage: "proposal" | "share"; disabled?: boolean; refreshKey?: string;
  customerPanel?: ReactNode;
  onReviewEvidence?: () => void;
  onContinue?: () => void; onBusyChange?: (busy: boolean) => void;
}>(function ProposalWorkflow({ reportId, stage, disabled, refreshKey, customerPanel, onContinue, onReviewEvidence, onBusyChange }, ref) {
  const paths = useAppraisalRoutes(reportId);
  const [workspace, setWorkspace] = useState<ProposalWorkspace | null>(null);
  const sourceKey = `${reportId}:${refreshKey ?? ""}`;
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);
  const [section, setSection] = useState<"content" | "preview">("content");
  const [shareTab, setShareTab] = useState("share");
  const [customising, setCustomising] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoPreviewRevision, setPhotoPreviewRevision] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [committing, setCommitting] = useState(false);
  const busy = uploading || committing;
  const [sharing, setSharing] = useState(false);
  useEffect(() => { onBusyChange?.(busy || savingDraft || sharing); }, [busy, savingDraft, sharing, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const commits = useRef(0);
  const loaded = useRef(false);
  const form = useForm<ProposalDraft>({ defaultValues: DEFAULT_PROPOSAL_DRAFT });
  const draft = useWatch({ control: form.control }) as ProposalDraft;
  const { reset, getValues } = form;
  const saver = useMemo(() => createProposalDraftSaver({
    readDraft: getValues,
    request: (draft, revision) => proposalFetch<SavedProposalDraft>(`${paths.api}/proposal`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft, revision }),
    }),
    recover: async () => {
      const fresh = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`);
      return fresh.draft ? { draft: fresh.draft, revision: fresh.revision } : null;
    },
    onSaving: saving => { setSavingDraft(saving); if (saving) setMessage(""); },
    onError: setSaveError,
    onSaved: (saved, submitted) => {
      const current = structuredClone(getValues());
      const merged = mergeSavedProposalDraft(submitted, current, saved.draft);
      // First update the saved baseline, then restore any edits typed in flight.
      reset(saved.draft);
      if (JSON.stringify(merged) !== JSON.stringify(saved.draft)) reset(merged, { keepDefaultValues: true });
      setWorkspace(previous => previous && ({ ...previous, ...saved }));
    },
  }), [getValues, reset, paths.api]);
  useEffect(() => {
    loaded.current = false;
    return () => saver.dispose();
  }, [saver]);
  useEffect(() => {
    let cancelled = false;
    saver.setSource(null);
    const load = async () => {
      // A refreshed customer must read the revision returned by an earlier save.
      if (saver.pending) await saver.pending;
      if (cancelled) return;
      const value = await proposalFetch<ProposalWorkspace>(`${paths.api}/proposal`);
      if (cancelled) return;
      setWorkspace(value);
      setLoadedSourceKey(sourceKey);
      setLoadError(null);
      if (!loaded.current && value.assignment) { reset(applyAssignment(value.draft, value.assignment)); loaded.current = true; }
      saver.setSource(value.data ? { data: value.data, draft: value.draft, revision: value.revision } : null);
      setMessage("");
    };
    void load().catch(error => { if (!cancelled) setLoadError({ key: sourceKey, message: error.message }); });
    return () => { cancelled = true; };
  }, [reportId, sourceKey, reset, paths.api, saver]);
  const autosavePaused = busy || sharing || disabled || customising || photoPickerOpen || Boolean(saveError);
  useEffect(() => {
    if (!form.formState.isDirty || autosavePaused || savingDraft || loadedSourceKey !== sourceKey) return;
    const timer = setTimeout(() => { void saver.saveOnce(); }, PROPOSAL_AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draft, form.formState.isDirty, autosavePaused, savingDraft, loadedSourceKey, sourceKey, saver]);
  async function save(updateDraft?: (current: ProposalDraft) => ProposalDraft) {
    if (!workspace?.data || loadedSourceKey !== sourceKey) return null;
    commits.current += 1;
    setCommitting(true); setMessage("");
    try {
      const revision = await saver.flush(updateDraft);
      if (revision !== null) setMessage("Changes saved.");
      return revision;
    } finally { commits.current -= 1; setCommitting(commits.current > 0); }
  }
  async function savePhotos(propertyImages: ProposalPhotoSelection) {
    const revision = await save(current => ({ ...current, propertyImages }));
    if (revision === null) return false;
    setMessage("Photos saved to this proposal. Preview updated.");
    setPhotoPreviewRevision(current => current + 1);
    setSection("preview");
    return true;
  }
  function editPhotos() { setPhotoPickerOpen(true); }
  async function finishCustomising() {
    if (busy || disabled) return;
    if (form.formState.isDirty && (await save()) === null) return;
    setCustomising(false);
  }
  useImperativeHandle(ref, () => ({ savePendingEdits: async () => (await save()) !== null }));
  const updateWorkspace = (change: Partial<ProposalWorkspace>) => setWorkspace(current => current && ({ ...current, ...change }));
  // A customer edit changes the publication fingerprint. Do not expose sharing
  // controls for the previous customer while the new workspace is loading.
  if (!workspace?.assignment || !workspace.data || !loaded.current || loadedSourceKey !== sourceKey) return <div role="status" className="p-6">{loadError?.key === sourceKey ? loadError.message : "Loading your proposal…"}</div>;
  const validation = validateProposalDraft(draft, workspace.data);
  const previewData = withProposalPhotos(withProposalAgents(workspace.data, draft.agentIds ?? [], workspace.availableAgents ?? []), draft.propertyImages);
  const photoSelection = { heroImageUrl: previewData.property.heroImageUrl, gallery: [...new Set([...previewData.property.gallery, previewData.property.heroImageUrl].filter(Boolean))] };
  const preview = <MultiPageProposal key={photoPreviewRevision} initialPage={photoPreviewRevision ? draft.pages.find(page => page.kind === "hero" && page.enabled)?.id : undefined} data={previewData} draft={draft} brand={assignmentBrand(workspace.assignment)} previewPdfDownload
    attachments={workspace.attachments.filter(item => draft.attachmentIds.includes(item.id)).map(item => ({ ...item, href: `${paths.api}/proposal/attachments/${item.id}` }))} />;
  return <section data-theme="staypack-workspace" className="min-w-0 space-y-5 text-base-content">
    <UnsavedListingGuard dirty={form.formState.isDirty || savingDraft} description="Your latest proposal changes have not finished saving. Stay to save them, or discard them and leave." />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{stage === "proposal" ? "Check your proposal" : "Get link or PDF"}</h2>
      {stage === "proposal" && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || sharing || disabled} className="du-btn du-btn-sm min-h-11" onClick={() => setSection(section === "preview" ? "content" : "preview")}><Eye size={16} aria-hidden="true" />{section === "preview" ? "Close preview" : "Preview proposal"}</button>
      </div>}
    </div>
    {(stage === "proposal" || savingDraft) && <p role="status" className="text-sm text-base-content/65">{savingDraft || (form.formState.isDirty && !autosavePaused) ? "Saving…" : saveError ? "Changes not saved" : form.formState.isDirty ? "Unsaved changes." : workspace.draft ? "Saved" : "Changes save automatically."}</p>}
    {workspace.needsEvidenceReview && <div role="status" className="du-alert du-alert-warning du-alert-soft flex flex-wrap items-center gap-3"><p className="min-w-0 flex-1">Review the updated estimate before publishing. Your shared proposal is unchanged.</p>{onReviewEvidence && <button type="button" className="du-btn du-btn-sm min-h-11" disabled={busy || savingDraft || sharing || disabled} onClick={onReviewEvidence}>Review estimate</button>}</div>}
    {stage === "proposal" && message && !form.formState.isDirty && <p role="status" className="text-sm">{message}</p>}
    {saveError && !photoPickerOpen && !customising && <div role="alert" className="du-alert du-alert-error du-alert-soft flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1">{saveError}</span><button type="button" disabled={busy || disabled} className="du-btn du-btn-sm min-h-11" onClick={() => void save()}>Retry save</button></div>}
    {photoPickerOpen && <ProposalPhotoPicker open onOpenChange={setPhotoPickerOpen} availablePhotos={workspace.availablePhotos ?? photoSelection.gallery} value={photoSelection} onSave={savePhotos} error={saveError} coverPageIncluded={draft.pages.some(page => page.kind === "hero" && page.enabled)} disabled={busy || sharing || disabled} />}
    {stage === "proposal" && section !== "preview" && <>
      <div className="grid gap-5 lg:grid-cols-2 lg:grid-rows-[1fr_1fr]">
        <ProposalAgentPicker form={form} selected={draft.agentIds ?? []} agents={workspace.availableAgents ?? []} disabled={busy || disabled} />
        <ProposalCoverSummary data={previewData} onEditPhotos={editPhotos} disabled={busy || disabled} />
        <ProposalDocumentsEditor layout="grid-items" form={form} draft={draft} reportId={reportId} workspace={workspace} onWorkspaceChange={updateWorkspace} disabled={busy || disabled} onBusyChange={setUploading} />
      </div>
      <Dialog open={customising} onOpenChange={(open, details) => { if (!open && (busy || disabled)) { details.cancel(); return; } setCustomising(open); }}>
        <DialogTrigger render={<button type="button" disabled={busy || disabled} className="du-btn du-btn-sm min-h-11" />}><LayoutList size={16} aria-hidden="true" />Edit pages<span className="du-badge du-badge-sm">Optional</span></DialogTrigger>
        <DialogContent data-theme="staypack-workspace" showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl bg-base-100 p-0 text-base-content sm:max-w-3xl">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-base-300 p-5 sm:px-6">
            <div><DialogTitle className="text-lg font-semibold">Edit pages</DialogTitle><DialogDescription className="mt-2 text-sm text-base-content/65">Choose pages and their order.</DialogDescription></div>
            <button type="button" aria-label="Close pages" disabled={busy || disabled} onClick={() => setCustomising(false)} className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"><X size={18} aria-hidden="true" /></button>
          </div>
          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            <fieldset disabled={busy || disabled} className="min-w-0">
              <ProposalPagesEditor form={form} draft={draft} contentEditable={false} disabled={busy || disabled} />
            </fieldset>
          </div>
          <div className="shrink-0 space-y-3 border-t border-base-300 bg-base-200/35 p-4 sm:px-6">
            {saveError && <p role="alert" className="du-alert du-alert-error du-alert-soft">{saveError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm text-base-content/65">{busy ? "Please wait…" : form.formState.isDirty ? "Unsaved changes." : "No unsaved changes."}</p>
              <button type="button" disabled={busy || disabled} onClick={() => void finishCustomising()} className="du-btn du-btn-sm du-btn-primary min-h-11">{form.formState.isDirty ? "Save changes" : "Done"}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>}
    {stage === "proposal" && section === "preview" && <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-base-300">{validation.draft ? preview : <p className="p-5">{validation.errors.join(" ")}</p>}</div>}
    {stage === "proposal" ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-5"><p className="text-sm text-base-content/65">Changes save automatically. Nothing is published or sent.</p><button type="button" className="du-btn du-btn-sm du-btn-primary h-auto min-h-12 w-full whitespace-normal py-3 sm:w-auto" disabled={busy || savingDraft || disabled} onClick={onContinue}>Continue to get link or PDF<ArrowRight size={16} className="shrink-0" aria-hidden="true" /></button></div> : <AppraisalStepTabs label="Sharing and activity" value={shareTab} onValueChange={setShareTab} disabled={busy || sharing || disabled} tabs={[{ value: "share", label: "Share proposal" }, { value: "activity", label: "Client activity" }]}>
      <AppraisalStepPanel value="share">
        <ProposalSharePanel reportId={reportId} workspace={workspace} customerPanel={customerPanel} onSave={save} onWorkspaceChange={updateWorkspace} hasUnsavedChanges={form.formState.isDirty} valid={Boolean(validation.draft) && !disabled && !workspace.needsEvidenceReview} disabled={disabled || busy} onBusyChange={setSharing} onPreviewDraft={() => setSection(section === "preview" ? "content" : "preview")} previewingDraft={section === "preview"} draftPreview={section === "preview" ? <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-base-300">{validation.draft ? preview : <p className="p-5">{validation.errors.join(" ")}</p>}</div> : undefined} />
      </AppraisalStepPanel>
      <AppraisalStepPanel value="activity" keepMounted={false}>
        <ProposalActivity reportId={reportId} refreshKey={workspace.versions.map(item => `${item.id}:${item.revoked_at ?? "active"}`).join()} />
      </AppraisalStepPanel>
    </AppraisalStepTabs>}
  </section>;
});
