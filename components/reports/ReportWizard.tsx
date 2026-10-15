"use client";

import { CreateAnother, PropertyContext } from "@/components/properties/PropertyContext";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProposalWorkflow, type ProposalWorkflowHandle } from "@/components/digital-proposals/ProposalWorkflow";
import { AppraisalWizardNavigation } from "@/components/appraisals/AppraisalWizardNavigation";
import { LayoutTemplate } from "lucide-react";
import { StrPropertyStep, type StrPropertyHandle } from "./StrPropertyStep";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DocumentGenerationStatus } from "@/components/documents/DocumentGenerationStatus";
import {
  StrDesignStep,
  type StrDesignHandle,
} from "@/components/reports/StrDesignStep";
import {
  StrEstimateStep,
  type StrEstimateHandle,
} from "@/components/reports/StrEstimateStep";
import {
  GeneratedCopyEditor,
  type StrCopyEditorHandle,
} from "@/components/reports/GeneratedCopyEditor";
import { StrReportDeliveryStep } from "@/components/reports/StrReportDeliveryStep";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import { applyDocumentLinkDraft } from "@/lib/documents/documentLink";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { calculateAccommodates } from "@/lib/reports/formatters";
import { calculatorPropertyReviewRequired } from "@/lib/str-calculator/propertyReviewRequired";
import { strPropertyContextSchema } from "@/lib/str/propertyInputs";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import type { Agency, AgentProfile, Listing, Report } from "@/lib/types";

const steps = [
  { id: "property", label: "Property" },
  { id: "estimate", label: "Estimate & evidence" },
  { id: "design", label: "Design & content" },
  { id: "preview", label: "Review & share" },
];

export function ReportWizard({
  initialListing,
  calculatorReview = false,
  initialReport,
  agency,
  availableTemplates,
  customerPanel,
  appraisalActions,
  customerEditing = false,
  digitalProposal = false,
  customerRevision,
  onListingChange,
  onReportChange,
}: {
  calculatorReview?: boolean;
  initialListing: Listing;
  initialReport: Report;
  agency: Agency;
  availableTemplates?: TemplatesResponse;
  customerPanel?: ReactNode;
  appraisalActions?: ReactNode;
  customerEditing?: boolean;
  digitalProposal?: boolean;
  customerRevision?: string;
  onListingChange?: (listing: Listing) => void;
  onReportChange?: (report: Report) => void;
}) {
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);
  const reportRef = useRef(initialReport);
  const [reviewRequested, setReviewRequested] = useState(calculatorReview || calculatorPropertyReviewRequired(initialReport, initialListing));
  const [step, setStep] = useState(
    reviewRequested ? "property" : initialReport.final_report_json
      ? "preview"
      : initialReport.final_estimate_json
        ? "estimate"
        : "property",
  );
  const [choosingDesign, setChoosingDesign] = useState(!initialReport.final_report_json);
  const propertyRef = useRef<StrPropertyHandle>(null);
  const [busy, setBusy] = useState(false);
  const navigating = useRef(false);
  const [childBusy, setChildBusy] = useState(false);
  const [activity, setActivity] = useState<"estimate" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>([]);
  const [previewAgency, setPreviewAgency] = useState(agency);
  const [canManageStrDefaults, setCanManageStrDefaults] = useState(false);
  const proposalRef = useRef<ProposalWorkflowHandle>(null);
  const wizardSteps = digitalProposal ? steps.map(item => ({ ...item, label: ({ estimate: "Rental appraisal", design: "Proposal", preview: "Customer & share" } as Record<string, string>)[item.id] ?? item.label })) : steps;
  const designRef = useRef<StrDesignHandle>(null);
  const estimateRef = useRef<StrEstimateHandle>(null);
  const copyRef = useRef<StrCopyEditorHandle>(null);
  const disabled = busy || childBusy || customerEditing;

  function updateReport(next: Report) {
    reportRef.current = next;
    setReport(next);
    onReportChange?.(next);
  }
  function updateListing(next: Listing) {
    setListing(next);
    onListingChange?.(next);
  }
  useEffect(() => {
    reportRequest<{ agents: AgentProfile[] }>("/api/agents")
      .then((payload) => setAgencyAgents(payload.agents ?? []))
      .catch(() => {});
    const reloadCompanySettings = () => {
      void reportRequest<{ agency: Agency; can_manage_str_defaults?: boolean }>("/api/agencies")
        .then((payload) => {
          if (payload.agency?.id === agency.id) {
            setPreviewAgency(payload.agency);
            setCanManageStrDefaults(payload.can_manage_str_defaults === true);
          }
        })
        .catch(() => {});
    };
    reloadCompanySettings();
    // A preset may have been edited in the settings tab. Report inputs stay local.
    window.addEventListener("focus", reloadCompanySettings);
    return () => window.removeEventListener("focus", reloadCompanySettings);
  }, [agency.id]);
  const preview = useMemo(
    () =>
      report.final_report_json
        ? resolveFinalReportForDisplay(
            enrichFinalReportMetrics(
              listing,
              mergeAgencyBrandIntoFinalReport(
                previewAgency,
                applyDocumentLinkDraft(report.final_report_json),
              ),
              { agencyAgents },
            ),
          )
        : null,
    [report.final_report_json, listing, previewAgency, agencyAgents],
  );

  async function saveProperty(): Promise<"saved" | "review" | false> {
    const property = await propertyRef.current?.read();
    if (!property) return false;
    const { values } = property;
    if (!property.profile.property_address?.trim())
      throw new Error(
        "Add a property address on the listing before getting an estimate.",
      );
    let current = reportRef.current;
    let currentListing = property.profile;
    if (values.car_spaces !== (property.profile.car_spaces ?? null)) {
      const saved = await reportRequest<{ listing: Listing }>(
        `/api/listings/${listing.id}`,
        jsonRequest({ car_spaces: values.car_spaces }, "PATCH"),
      );
      currentListing = saved.listing;
    } else {
      currentListing.car_spaces = values.car_spaces;
    }
    updateListing(currentListing);
    const context = strPropertyContextSchema.parse(values);
    const contextChanged = JSON.stringify(context) !== JSON.stringify(current.user_overrides_json?.strProperty);
    const parkingSnapshotChanged = current.final_report_json && current.final_report_json.property.car_spaces !== (values.car_spaces ?? 0);
    if (contextChanged || parkingSnapshotChanged) {
      const saved = await reportRequest<{ report: Report }>(
        `/api/reports/${current.id}`,
        jsonRequest(
          {
            str_property: context,
            ...(reviewRequested ? { calculator_property_review: true } : {}),
          },
          "PATCH",
        ),
      );
      current = saved.report;
      updateReport(current);
    }
    const inputs = current.user_overrides_json?.estimateInputs ?? {
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      accommodates: calculateAccommodates(
        listing.bedrooms,
        listing.accommodates,
      ),
    };
    if (
      reviewRequested || !current.final_estimate_json ||
      inputs.bedrooms !== values.bedrooms ||
      inputs.bathrooms !== values.bathrooms ||
      inputs.accommodates !== values.accommodates
    ) {
      setActivity("estimate");
      const result = await reportRequest<{ listing: Listing; report: Report }>(
        "/api/str/estimate",
        jsonRequest({
          report_id: current.id,
          ...(reviewRequested ? { confirm_calculator_property: true } : {}),
          address: currentListing.property_address,
          latitude: currentListing.latitude,
          longitude: currentListing.longitude,
          bedrooms: values.bedrooms,
          bathrooms: values.bathrooms,
          accommodates: values.accommodates,
        }),
      );
      updateListing(result.listing);
      updateReport(result.report);
      setReviewRequested(false);
      return "review";
    }
    return "saved";
  }

  async function saveTemplate() {
    const templateId = designRef.current?.read();
    if (!templateId) return false;
    const current = reportRef.current;
    if (templateId !== current.template_id) {
      const saved = await reportRequest<{ report: Report }>(
        `/api/reports/${current.id}`,
        jsonRequest({ template_id: templateId }, "PATCH"),
      );
      updateReport(saved.report);
    }
    return true;
  }

  async function applyDesign() {
    if (disabled || navigating.current) return;
    navigating.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!(await saveTemplate())) return;
      const current = reportRef.current;
      if (!current.final_report_json) {
        if (!current.final_estimate_json)
          throw new Error("Get an estimate before writing the report.");
        setActivity("copy");
        const result = await reportRequest<{ report: Report }>(
          `/api/reports/${current.id}/generate-copy`,
          jsonRequest({ template_id: current.template_id }),
        );
        if (!result.report?.final_report_json)
          throw new Error("The report was not generated. Please try again.");
        updateReport(result.report);
      }
      setChoosingDesign(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to apply this design. Please try again.");
    } finally {
      navigating.current = false;
      setBusy(false);
      setActivity(null);
    }
  }

  async function changeDesign() {
    if (disabled || navigating.current) return;
    navigating.current = true;
    setBusy(true);
    setError(null);
    try {
      if (await copyRef.current?.savePendingEdits()) setChoosingDesign(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your content. Please try again.");
    } finally {
      navigating.current = false;
      setBusy(false);
    }
  }

  async function handleStepChange(next: string) {
    if (disabled || navigating.current || next === step) return;
    navigating.current = true;
    setBusy(true);
    setError(null);
    try {
      if (step === "property") {
        const result = await saveProperty();
        if (!result) return;
        if (result === "review") {
          setStep("estimate");
          window.scrollTo({ top: 0, behavior: "instant" });
          return;
        }
      }
      if (
        step === "estimate" &&
        !(await estimateRef.current?.savePendingEdits())
      )
        return;
      if (digitalProposal && (step === "design" || step === "preview")) {
        if (!(await proposalRef.current?.savePendingEdits())) return;
      }
      if (!digitalProposal && step === "design") {
        if (choosingDesign) {
          // A template outage must not trap the user away from their evidence.
          if (designRef.current?.read() && !(await saveTemplate())) return;
        } else if (!(await copyRef.current?.savePendingEdits())) return;
      }
      setStep(next);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to continue. Your changes are still here; please try again.",
      );
    } finally {
      navigating.current = false;
      setBusy(false);
      setActivity(null);
    }
  }

  const progress = activity ? (
    <DocumentGenerationStatus
      title={
        activity === "estimate"
          ? "Getting your estimate"
          : "Writing your report"
      }
      description={
        activity === "estimate"
          ? "Checking comparable short-term rentals around your property."
          : "Your chosen design and reviewed figures are ready."
      }
      headline={
        activity === "estimate"
          ? "Building the market evidence"
          : "Preparing your short-term rental appraisal"
      }
      body={
        activity === "estimate"
          ? "Finding comparable properties and assessing the estimated gross STR revenue. You can review and adjust the figures next."
          : "Writing the property summary and supporting evidence, then applying your branding and photos."
      }
      savedLabel={
        activity === "estimate"
          ? "Property details checked"
          : "Property, estimate and design saved"
      }
      activeLabel={
        activity === "estimate"
          ? "Preparing estimated figures and comparable evidence"
          : "Writing and laying out your report"
      }
    />
  ) : null;

  return (
    <div className="min-w-0 space-y-4">
      {error ? (
        <p
          role="alert"
          data-theme="staypack-workspace"
          className="du-alert du-alert-error du-alert-soft"
        >
          {error}
        </p>
      ) : null}
      {appraisalActions ? <div inert={disabled}>{appraisalActions}</div> : null}
      {digitalProposal && <PropertyContext listing={listing} onEdit={() => void handleStepChange("property")} />}
      <Tabs
        value={step}
        onValueChange={(next) => void handleStepChange(String(next))}
        className="gap-4"
      >
        <AppraisalWizardNavigation
          label="Report creation steps"
          currentStep={step}
          steps={wizardSteps.map(item => ({
            ...item,
            disabled: disabled || (reviewRequested && item.id !== "property") ||
              (item.id === "estimate" && step !== "property" && !report.final_estimate_json) ||
              (item.id === "design" && !report.final_estimate_json && !report.final_report_json) ||
              (item.id === "preview" && (digitalProposal ? !report.final_estimate_json : !report.final_report_json)),
          }))}
        />
        <TabsContent value="property">
          {progress}
          <div hidden={Boolean(activity)}>
            <StrPropertyStep
              ref={propertyRef}
              calculatorReview={reviewRequested}
              listing={listing}
              report={report}
              busy={disabled}
              onContinue={() => void handleStepChange("estimate")}
            />
          </div>
        </TabsContent>
        <TabsContent value="estimate">
          {progress}
          <div hidden={Boolean(activity)}>
            <StrEstimateStep
              ref={estimateRef}
              continueLabel={digitalProposal ? "Continue to proposal" : undefined}
              agency={previewAgency}
              canManageDefaults={canManageStrDefaults}
              onCompanyPresetsChange={(presets) => setPreviewAgency((current) => ({ ...current, str_management_presets: presets }))}
              onBusyChange={setChildBusy}
              key={report.str_enrichment_json?.fetched_at ?? report.airbtics_fetched_at ?? "no-estimate"}
              listing={listing}
              report={report}
              busy={disabled}
              onComplete={updateReport}
              onContinue={() => void handleStepChange("design")}
              onBack={() => void handleStepChange("property")}
            />
          </div>
        </TabsContent>
        <TabsContent value="design">
          {progress}
          <div hidden={Boolean(activity)}>
            {digitalProposal ? <ProposalWorkflow ref={proposalRef} reportId={report.id} stage="proposal" disabled={busy} onBusyChange={setChildBusy} onContinue={() => void handleStepChange("preview")} /> : choosingDesign ? (
              <StrDesignStep
                ref={designRef}
                agency={previewAgency}
                agencyAgents={agencyAgents}
                listing={listing}
                report={report}
                availableTemplates={availableTemplates}
                busy={disabled}
                onContinue={() => void applyDesign()}
                onBack={() => void handleStepChange("estimate")}
              />
            ) : (
              <div className="space-y-4">
                <div data-theme="staypack-workspace" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-base-content/65">Your design is ready. Personalise the content below.</p>
                  <button type="button" className="du-btn du-btn-sm min-h-11" disabled={disabled} onClick={() => void changeDesign()}>
                    <LayoutTemplate className="size-4" aria-hidden="true" />Change report design
                  </button>
                </div>
                <GeneratedCopyEditor
                  ref={copyRef}
                  agency={previewAgency}
                  agencyAgents={agencyAgents}
                  listing={listing}
                  report={report}
                  onComplete={updateReport}
                  onBusyChange={setChildBusy}
                  onContinueToPreview={() => void handleStepChange("preview")}
                />
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="preview" className="space-y-5">
          {!digitalProposal && customerPanel ? <fieldset disabled={busy || childBusy} className="min-w-0">{customerPanel}</fieldset> : null}
          {digitalProposal ? <ProposalWorkflow ref={proposalRef} reportId={report.id} stage="share" refreshKey={customerRevision} customerPanel={customerPanel ? <fieldset disabled={busy || childBusy} className="min-w-0">{customerPanel}</fieldset> : undefined} disabled={customerEditing || busy} onBusyChange={setChildBusy} /> : preview ? (
            <StrReportDeliveryStep
              disabled={customerEditing}
              report={report}
              preview={preview}
              onReportChange={updateReport}
              onEdit={() => void handleStepChange("design")}
              onBusyChange={setChildBusy}
            />
          ) : null}
        </TabsContent>
      </Tabs>
      {digitalProposal && step === "preview" && !busy && !childBusy && !customerEditing && <CreateAnother listingId={listing.id} />}
    </div>
  );
}
