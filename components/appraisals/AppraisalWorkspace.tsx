"use client";
import { CreateAnother } from "@/components/properties/PropertyContext";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Listing, LeaseAppraisalJob } from "@/lib/types";
import type { WorkspaceAppraisal } from "@/lib/appraisals/workspaceTypes";
import { AppraisalWizardNavigation } from "./AppraisalWizardNavigation";
import { AppraisalRoutes } from "./AppraisalRoutes";
import { AppraisalPropertyStep } from "./AppraisalPropertyStep";
import { LeaseAppraisalDataStep } from "@/components/lease-appraisal/LeaseAppraisalDataStep";
import { SalesAppraisalDataStep } from "@/components/sales-appraisal/SalesAppraisalDataStep";
import { ProposalWorkflow, type ProposalWorkflowHandle } from "@/components/digital-proposals/ProposalWorkflow";
import { proposalFetch } from "@/components/digital-proposals/ProposalWorkspaceControls";
import { AppraisalCustomerPanel } from "@/components/str-appraisals/AppraisalCustomerPanel";
import { AppraisalArchiveControl } from "@/components/str-appraisals/AppraisalArchiveControl";
const steps = [ ["property", "Confirm property"], ["evidence", "Review estimate"], ["proposal", "Check proposal"], ["share", "Get link or PDF"] ] as const;
type Step = typeof steps[number][0];
export function AppraisalWorkspace({ initialAppraisal, initialListing, initialJob = null, hasPublishedProposal = false, archived }: { initialJob?: LeaseAppraisalJob | null; initialAppraisal: WorkspaceAppraisal; initialListing: Listing; hasPublishedProposal?: boolean; archived: boolean }) {
  const [appraisal, setAppraisal] = useState(initialAppraisal);
  const [listing, setListing] = useState(initialListing);
  const [step, setStep] = useState<Step>(hasPublishedProposal ? "share" : initialAppraisal.document_json && initialAppraisal.document_revision === initialAppraisal.input_revision ? "proposal" : "property");
  const [busy,setBusy] = useState(false); const [generating,setGenerating] = useState(false); const [editingCustomer,setEditingCustomer] = useState(false); const [error,setError] = useState("");
  const [navigating, setNavigating] = useState(false);
  const navigationPending = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView?.({ block: "center" });
      errorRef.current?.focus({ preventScroll: true });
    }
  }, [error]);
  const disabled = busy || generating || navigating || editingCustomer;
  const [evidenceDirty, setEvidenceDirty] = useState(false);
  const [job,setJob] = useState<LeaseAppraisalJob | null>(initialJob);
  const workflow = useRef<ProposalWorkflowHandle>(null);
  const hasDocument = Boolean(appraisal.document_json);
  const propertyStep = useRef<{ save: () => Promise<boolean> }>(null);
  function openStep(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function changeStep(next: Step) {
    if (navigationPending.current || disabled || next === step) return;
    if (step === "evidence" && evidenceDirty) { setError("Choose ‘Use this estimate’ to save your evidence changes before switching steps."); return; }
    navigationPending.current = true; setNavigating(true); setError("");
    try {
      if (step === "property" && !(await propertyStep.current?.save())) return;
      if ((step === "proposal" || step === "share") && !(await workflow.current?.savePendingEdits())) return;
      openStep(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save changes. Please try again.");
    } finally { navigationPending.current = false; setNavigating(false); }
  }
  const evidenceChanged = useCallback((next: Listing) => {
    setListing(next); setAppraisal(current => ({ ...current, updated_at: next.updated_at, document_revision: next.updated_at === current.updated_at ? current.document_revision : null }));
  }, []);
  async function prepare(next?: Listing, refreshCopy = false) {
    setGenerating(true); setError("");
    try { const result = await proposalFetch<{ appraisal: WorkspaceAppraisal }>(`/api/appraisals/${appraisal.report_id}/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_updated_at: next?.updated_at ?? listing.updated_at, ...(refreshCopy ? { refresh_copy: true } : {}) }) }); setAppraisal(result.appraisal); setListing(current => ({ ...current, updated_at: result.appraisal.updated_at })); openStep("proposal"); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Unable to prepare proposal."); }
    finally { setGenerating(false); }
  }
  async function refreshCopy() {
    if (navigationPending.current || disabled) return;
    navigationPending.current = true; setNavigating(true); setError("");
    try {
      if (!(await workflow.current?.savePendingEdits())) return;
      await prepare(undefined, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save changes. Please try again.");
    } finally { navigationPending.current = false; setNavigating(false); }
  }
  return <AppraisalRoutes><div data-theme="staypack-workspace" className="space-y-6 text-base-content">
    {archived ? <><AppraisalCustomerPanel initialAppraisal={appraisal} archived /><p>This appraisal is archived. Restore it to continue editing. Existing share links remain revoked.</p></> : <>
      <AppraisalWizardNavigation label="Appraisal steps" currentStep={step} onStepChange={next => void changeStep(next as Step)} steps={steps.map(([id, label]) => ({ id, label, disabled: disabled || ((id === "proposal" || id === "share") && !hasDocument) }))} />
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="du-alert du-alert-error du-alert-soft">{error}</p>}
      {generating && <p role="status" className="du-alert">Preparing your proposal…</p>}
      {step === "property" && <AppraisalPropertyStep ref={propertyStep} key={appraisal.report_id} listing={listing} appraisal={appraisal} onBusyChange={setBusy} onSaved={result => { setListing(result.listing); setAppraisal(result.appraisal); }} onContinue={() => openStep("evidence")} />}
      {step === "evidence" && <fieldset disabled={generating || navigating} className="min-w-0">{appraisal.kind === "lease" ? <LeaseAppraisalDataStep appraisalEndpoint={`/api/appraisals/${appraisal.report_id}/evidence`} listing={listing} activeJob={job} onDirtyChange={setEvidenceDirty} onJobChange={setJob} onListingChange={evidenceChanged} onBusyChange={setBusy} onContinue={next => void prepare(next)} continueLabel="Use this estimate" /> : <SalesAppraisalDataStep appraisalEndpoint={`/api/appraisals/${appraisal.report_id}/evidence`} listing={listing} activeJob={job} onDirtyChange={setEvidenceDirty} onJobChange={setJob} onListingChange={evidenceChanged} onBusyChange={setBusy} onContinue={next => void prepare(next)} continueLabel="Use this estimate" />}</fieldset>}

      {(step === "proposal" || step === "share") && <ProposalWorkflow key={step} ref={workflow} reportId={appraisal.report_id} stage={step === "share" ? "share" : "proposal"} refreshKey={appraisal.updated_at} disabled={editingCustomer || generating || navigating} onBusyChange={setBusy} onContinue={() => void changeStep("share")} onReviewEvidence={() => void changeStep("evidence")}
        customerPanel={step === "share" ? <fieldset disabled={busy || generating || navigating} className="min-w-0"><AppraisalCustomerPanel key={appraisal.updated_at} initialAppraisal={appraisal} archived={false} layout="inline" onEditingChange={setEditingCustomer} onSaved={saved => { setAppraisal(current => ({ ...current, ...saved })); setListing(current => ({ ...current, updated_at: saved.updated_at })); }} /></fieldset> : undefined} />}
      {step === "proposal" && <details className="text-sm"><summary className="w-fit cursor-pointer py-2 text-base-content/65">More options</summary><div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" className="du-btn du-btn-sm min-h-11" disabled={disabled} onClick={() => void refreshCopy()}>Refresh proposal wording</button><span className="text-base-content/65">Replace the wording using your saved estimate.</span></div></details>}
      {step === "share" && !disabled && <CreateAnother listingId={listing.id} sourceReportId={appraisal.report_id} />}
      <div inert={disabled}><AppraisalArchiveControl reportId={appraisal.report_id} /></div>
    </>}
  </div></AppraisalRoutes>;
}
