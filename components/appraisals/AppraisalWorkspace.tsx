"use client";
import { CreateAnother, PropertyContext } from "@/components/properties/PropertyContext";
import { useCallback, useRef, useState } from "react";
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
const steps = [ ["property", "Property"], ["evidence", "Review evidence"], ["proposal", "Proposal"], ["share", "Review & share"] ] as const;
type Step = typeof steps[number][0];
export function AppraisalWorkspace({ initialAppraisal, initialListing, initialJob = null, archived }: { initialJob?: LeaseAppraisalJob | null; initialAppraisal: WorkspaceAppraisal; initialListing: Listing; archived: boolean }) {
  const [appraisal, setAppraisal] = useState(initialAppraisal);
  const [listing, setListing] = useState(initialListing);
  const [step, setStep] = useState<Step>(initialAppraisal.document_json && initialAppraisal.document_revision === initialAppraisal.input_revision ? "proposal" : "property");
  const [busy,setBusy] = useState(false); const [generating,setGenerating] = useState(false); const [editingCustomer,setEditingCustomer] = useState(false); const [error,setError] = useState("");
  const [evidenceDirty, setEvidenceDirty] = useState(false);
  const [job,setJob] = useState<LeaseAppraisalJob | null>(initialJob);
  const workflow = useRef<ProposalWorkflowHandle>(null);
  const hasDocument = Boolean(appraisal.document_json);
  const propertyStep = useRef<{ save: () => Promise<boolean> }>(null);
  async function changeStep(next: Step) {
    if (busy || generating || editingCustomer || next === step) return;
    if (step === "evidence" && evidenceDirty) { setError("Use Continue to proposal to save your evidence changes before switching steps."); return; }
    if (step === "property" && !(await propertyStep.current?.save())) return;
    if ((step === "proposal" || step === "share") && !(await workflow.current?.savePendingEdits())) return;
    setStep(next); setError("");
  }
  const evidenceChanged = useCallback((next: Listing) => {
    setListing(next); setAppraisal(current => ({ ...current, updated_at: next.updated_at, document_revision: next.updated_at === current.updated_at ? current.document_revision : null }));
  }, []);
  async function prepare(next?: Listing, refreshCopy = false) {
    setGenerating(true); setError("");
    try { const result = await proposalFetch<{ appraisal: WorkspaceAppraisal }>(`/api/appraisals/${appraisal.report_id}/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_updated_at: next?.updated_at ?? listing.updated_at, ...(refreshCopy ? { refresh_copy: true } : {}) }) }); setAppraisal(result.appraisal); setListing(current => ({ ...current, updated_at: result.appraisal.updated_at })); setStep("proposal"); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Unable to prepare proposal."); }
    finally { setGenerating(false); }
  }
  async function refreshCopy() {
    if (busy || generating || editingCustomer || !(await workflow.current?.savePendingEdits())) return;
    await prepare(undefined, true);
  }
  return <AppraisalRoutes><div data-theme="staypack-workspace" className="space-y-6 text-base-content">
    <PropertyContext listing={listing} onEdit={archived ? undefined : () => void changeStep("property")} />
    {archived ? <><AppraisalCustomerPanel initialAppraisal={appraisal} archived /><p>This appraisal is archived. Restore it to continue editing. Existing share links remain revoked.</p></> : <>
      <fieldset disabled={busy || generating} className="min-w-0"><AppraisalCustomerPanel key={appraisal.updated_at} initialAppraisal={appraisal} archived={false} onEditingChange={setEditingCustomer} onSaved={saved => { setAppraisal(current => ({ ...current, ...saved })); setListing(current => ({ ...current, updated_at: saved.updated_at })); }} /></fieldset>
      <AppraisalWizardNavigation label="Appraisal steps" currentStep={step} onStepChange={next => void changeStep(next as Step)} steps={steps.map(([id, label]) => ({ id, label, disabled: busy || generating || editingCustomer || ((id === "proposal" || id === "share") && !hasDocument) }))} />
      {error && <p role="alert" className="du-alert du-alert-error">{error}</p>}
      {generating && <p role="status" className="du-alert">Preparing your proposal from the reviewed evidence…</p>}
      {step === "property" && <AppraisalPropertyStep ref={propertyStep} key={appraisal.report_id} listing={listing} appraisal={appraisal} onBusyChange={setBusy} onSaved={result => { setListing(result.listing); setAppraisal(result.appraisal); }} onContinue={() => setStep("evidence")} />}
      {step === "evidence" && <fieldset disabled={generating} className="min-w-0">{appraisal.kind === "lease" ? <LeaseAppraisalDataStep appraisalEndpoint={`/api/appraisals/${appraisal.report_id}/evidence`} listing={listing} activeJob={job} onDirtyChange={setEvidenceDirty} onJobChange={setJob} onListingChange={evidenceChanged} onBusyChange={setBusy} onContinue={next => void prepare(next)} continueLabel="Continue to proposal" /> : <SalesAppraisalDataStep appraisalEndpoint={`/api/appraisals/${appraisal.report_id}/evidence`} listing={listing} activeJob={job} onDirtyChange={setEvidenceDirty} onJobChange={setJob} onListingChange={evidenceChanged} onBusyChange={setBusy} onContinue={next => void prepare(next)} continueLabel="Continue to proposal" />}</fieldset>}

      {(step === "proposal" || step === "share") && <ProposalWorkflow ref={workflow} reportId={appraisal.report_id} stage={step === "share" ? "share" : "proposal"} refreshKey={appraisal.updated_at} disabled={editingCustomer || generating} onBusyChange={setBusy} onContinue={() => void changeStep("share")} />}
      {step === "proposal" && <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" className="du-btn du-btn-sm min-h-11" disabled={busy || generating || editingCustomer} onClick={() => void refreshCopy()}>Refresh proposal wording</button><span className="text-base-content/65">Rebuild the wording from your saved property details and evidence.</span></div>}
      {step === "share" && !busy && !generating && !editingCustomer && <CreateAnother listingId={listing.id} sourceReportId={appraisal.report_id} />}
      <div inert={busy || generating || editingCustomer}><AppraisalArchiveControl reportId={appraisal.report_id} /></div>
    </>}
  </div></AppraisalRoutes>;
}
