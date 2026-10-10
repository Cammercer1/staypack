"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { resolveAdvertisedPrice } from "@/lib/listings/pricing";
import { calculateAccommodates } from "@/lib/reports/formatters";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import type { Agency, AgentProfile, Listing, Report } from "@/lib/types";

const steps = [
  { id: "design", label: "Design & property" },
  { id: "estimate", label: "Estimate & evidence" },
  { id: "copy", label: "Edit report" },
  { id: "preview", label: "Download & share" },
];

export function ReportWizard({
  initialListing,
  initialReport,
  agency,
  availableTemplates,
  onListingChange,
  onReportChange,
}: {
  initialListing: Listing;
  initialReport: Report;
  agency: Agency;
  availableTemplates?: TemplatesResponse;
  onListingChange?: (listing: Listing) => void;
  onReportChange?: (report: Report) => void;
}) {
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);
  const reportRef = useRef(initialReport);
  const [step, setStep] = useState(
    initialReport.final_report_json
      ? "preview"
      : initialReport.final_estimate_json
        ? "estimate"
        : "design",
  );
  const [busy, setBusy] = useState(false);
  const navigating = useRef(false);
  const [childBusy, setChildBusy] = useState(false);
  const [activity, setActivity] = useState<"estimate" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>([]);
  const [previewAgency, setPreviewAgency] = useState(agency);
  const [canManageStrDefaults, setCanManageStrDefaults] = useState(false);
  const designRef = useRef<StrDesignHandle>(null);
  const estimateRef = useRef<StrEstimateHandle>(null);
  const copyRef = useRef<StrCopyEditorHandle>(null);
  const disabled = busy || childBusy;

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

  async function saveDesign(): Promise<"saved" | "review" | false> {
    const values = await designRef.current?.read();
    if (!values) return false;
    if (!listing.property_address?.trim())
      throw new Error(
        "Add a property address on the listing before getting an estimate.",
      );
    let current = reportRef.current;
    let currentListing = listing;
    const priceChanged =
      values.display_price !== (resolveAdvertisedPrice(listing, "sale") ?? "");
    if (priceChanged) {
      const saved = await reportRequest<{ listing: Listing }>(
        `/api/listings/${listing.id}`,
        jsonRequest(
          { advertised_sale_price: values.display_price || null },
          "PATCH",
        ),
      );
      currentListing = saved.listing;
      updateListing(currentListing);
    }
    if (values.templateId !== current.template_id || priceChanged) {
      const saved = await reportRequest<{ report: Report }>(
        `/api/reports/${current.id}`,
        jsonRequest(
          {
            template_id: values.templateId,
            ...(priceChanged && current.final_estimate_json
              ? { final_estimate_json: current.final_estimate_json }
              : {}),
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
      !current.final_estimate_json ||
      inputs.bedrooms !== values.bedrooms ||
      inputs.bathrooms !== values.bathrooms ||
      inputs.accommodates !== values.accommodates
    ) {
      setActivity("estimate");
      const result = await reportRequest<{ listing: Listing; report: Report }>(
        "/api/str/estimate",
        jsonRequest({
          report_id: current.id,
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
      return "review";
    }
    return "saved";
  }

  async function handleStepChange(next: string) {
    if (disabled || navigating.current || next === step) return;
    navigating.current = true;
    setBusy(true);
    setError(null);
    try {
      if (step === "design") {
        const result = await saveDesign();
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
      if (step === "copy" && !(await copyRef.current?.savePendingEdits()))
        return;
      const current = reportRef.current;
      if (next === "copy" && !current.final_report_json) {
        if (!current.final_estimate_json)
          throw new Error("Get an estimate before generating the report.");
        setActivity("copy");
        const result = await reportRequest<{ report: Report }>(
          `/api/reports/${current.id}/generate-copy`,
          jsonRequest({ template_id: current.template_id }),
        );
        if (!result.report?.final_report_json)
          throw new Error("The report was not generated. Please try again.");
        updateReport(result.report);
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
          ? "Property and design checked"
          : "Property, design and estimate saved"
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
      <Tabs
        value={step}
        onValueChange={(next) => void handleStepChange(String(next))}
        className="gap-4"
      >
        <TabsList
          aria-label="Report creation steps"
          className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:grid-cols-4"
        >
          {steps.map((item, index) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              disabled={
                disabled ||
                (item.id === "estimate" &&
                  step !== "design" &&
                  !report.final_estimate_json) ||
                (item.id === "copy" && !report.final_report_json) ||
                (item.id === "preview" && !report.final_report_json)
              }
              className="h-auto min-h-12 gap-2 whitespace-normal px-2 py-2 text-xs sm:text-sm"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs opacity-60"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="design">
          {progress}
          <div hidden={Boolean(activity)}>
            <StrDesignStep
              ref={designRef}
              agency={agency}
              agencyAgents={agencyAgents}
              listing={listing}
              report={report}
              availableTemplates={availableTemplates}
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
              agency={previewAgency}
              canManageDefaults={canManageStrDefaults}
              onCompanyPresetsChange={(presets) => setPreviewAgency((current) => ({ ...current, str_management_presets: presets }))}
              onBusyChange={setChildBusy}
              key={report.str_enrichment_json?.fetched_at ?? report.airbtics_fetched_at ?? "no-estimate"}
              listing={listing}
              report={report}
              busy={disabled}
              onComplete={updateReport}
              onContinue={() => void handleStepChange("copy")}
              onBack={() => void handleStepChange("design")}
            />
          </div>
        </TabsContent>
        <TabsContent value="copy">
          <GeneratedCopyEditor
            ref={copyRef}
            agency={agency}
            agencyAgents={agencyAgents}
            listing={listing}
            report={report}
            onComplete={updateReport}
            onBusyChange={setChildBusy}
            onContinueToPreview={() => void handleStepChange("preview")}
          />
        </TabsContent>
        <TabsContent value="preview">
          {preview ? (
            <StrReportDeliveryStep
              report={report}
              preview={preview}
              onReportChange={updateReport}
              onEdit={() => void handleStepChange("copy")}
              onBusyChange={setChildBusy}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
