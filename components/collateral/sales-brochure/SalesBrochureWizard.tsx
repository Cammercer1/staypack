"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GeneratedBrochureCopyEditor,
  type BrochureCopyEditorHandle,
} from "@/components/collateral/sales-brochure/GeneratedBrochureCopyEditor";
import { SalesBrochureTemplateStep } from "@/components/collateral/sales-brochure/SalesBrochureTemplateStep";
import { BrochureDeliveryStep } from "@/components/collateral/sales-brochure/BrochureDeliveryStep";
import { BrochureGenerationStatus } from "@/components/collateral/sales-brochure/BrochureGenerationStatus";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";

const steps = [
  { id: "template", label: "Design" },
  { id: "copy", label: "Edit brochure" },
  { id: "preview", label: "Download & share" },
];

export function SalesBrochureWizard({
  initialListing,
  initialCollateral,
  agency,
  collateralType = "sales_brochure",
  initialAgencyAgents,
  availableTemplates,
}: {
  initialListing: Listing;
  initialCollateral: CollateralItem;
  agency: Agency;
  collateralType?: "sales_brochure" | "rental_brochure";
  initialAgencyAgents?: AgentProfile[];
  availableTemplates?: TemplatesResponse;
}) {
  const [collateral, setCollateral] = useState(initialCollateral);
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>(
    initialAgencyAgents ?? [],
  );
  const [step, setStep] = useState(
    initialCollateral.document_json ? "preview" : "template",
  );
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const copyEditorRef = useRef<BrochureCopyEditorHandle>(null);
  const navigationPending = useRef(false);
  const listing = initialListing;
  useEffect(() => {
    if (initialAgencyAgents) return;
    let cancelled = false;
    fetch("/api/agents")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setAgencyAgents(payload.agents ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialAgencyAgents]);
  const agentProfile = useMemo(
    () =>
      listing.agent_profile_id != null
        ? (agencyAgents.find(
            (agent) => agent.id === listing.agent_profile_id,
          ) ?? null)
        : (agencyAgents.find((agent) => agent.is_default) ??
          agencyAgents[0] ??
          null),
    [agencyAgents, listing.agent_profile_id],
  );
  const document =
    collateral.document_json && isBrochureDocument(collateral.document_json)
      ? collateral.document_json
      : null;

  async function handleStepChange(next: string) {
    if (next === step || busy || navigationPending.current) return;
    navigationPending.current = true;
    try {
      if (
        step === "copy" &&
        copyEditorRef.current &&
        !(await copyEditorRef.current.savePendingEdits())
      )
        return;
      setStep(next);
    } finally {
      navigationPending.current = false;
    }
  }

  async function handleDesignSelected(next: CollateralItem) {
    setCollateral(next);
    setStep("copy");
    setGenerationError(null);
    if (next.document_json && isBrochureDocument(next.document_json)) return;
    setGenerating(true);
    setBusy(true);
    try {
      const response = await fetch(`/api/collateral/${next.id}/generate-copy`, {
        method: "POST",
      });
      const payload = await response.json();
      if (
        !response.ok ||
        !payload.collateral?.document_json ||
        !isBrochureDocument(payload.collateral.document_json)
      )
        throw new Error(
          payload.error ?? "Unable to write your brochure. Try again below.",
        );
      setCollateral(payload.collateral);
    } catch (err) {
      setGenerationError(
        err instanceof Error
          ? err.message
          : "Unable to write your brochure. Try again below.",
      );
    } finally {
      setGenerating(false);
      setBusy(false);
    }
  }

  return (
    <div data-theme="staypack-workspace" className="space-y-5">
      <Tabs value={step} onValueChange={(next) => void handleStepChange(next)}>
        <TabsList className="mb-2 grid h-auto w-full grid-cols-3 gap-1 p-1">
          {steps.map((item, index) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              disabled={
                busy ||
                (item.id === "copy" && !collateral.template_id) ||
                (item.id === "preview" && !document)
              }
              className="min-h-12 whitespace-normal px-2 text-xs sm:text-sm"
            >
              <span
                aria-hidden="true"
                className="hidden size-6 shrink-0 items-center justify-center rounded-full border text-xs sm:flex"
              >
                {index + 1}
              </span>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="template">
          <SalesBrochureTemplateStep
            agency={agency}
            listing={listing}
            collateral={collateral}
            collateralType={collateralType}
            agencyAgents={agencyAgents}
            availableTemplates={availableTemplates}
            onBusyChange={setBusy}
            onContinue={(next) => void handleDesignSelected(next)}
          />
        </TabsContent>
        <TabsContent value="copy" className="space-y-4">
          {generationError ? (
            <p role="alert" className="du-alert du-alert-error du-alert-soft">
              {generationError}
            </p>
          ) : null}
          {generating ? (
            <BrochureGenerationStatus />
          ) : (
            <GeneratedBrochureCopyEditor
              ref={copyEditorRef}
              agency={agency}
              listing={listing}
              collateral={collateral}
              agencyAgents={agencyAgents}
              agentProfile={agentProfile}
              onBusyChange={setBusy}
              onCollateralChange={(next) => {
                setCollateral(next);
                setGenerationError(null);
              }}
              onContinueToPreview={() => setStep("preview")}
            />
          )}
        </TabsContent>
        <TabsContent value="preview">
          {document ? (
            <BrochureDeliveryStep
              collateral={collateral}
              document={document}
              onCollateralChange={setCollateral}
              onEdit={() => setStep("copy")}
              onBusyChange={setBusy}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
