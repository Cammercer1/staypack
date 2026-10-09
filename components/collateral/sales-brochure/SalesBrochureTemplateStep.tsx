"use client";

import { useCallback, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { DocumentTemplateGallery } from "@/components/documents/DocumentTemplateGallery";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { buildBrochureTemplatePreview } from "@/lib/collateral/sales-brochure/templatePreviewDocument";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";

export function SalesBrochureTemplateStep({
  agency,
  listing,
  collateral,
  collateralType = "sales_brochure",
  agencyAgents = [],
  availableTemplates,
  onContinue,
  onBusyChange,
}: {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  collateralType?: "sales_brochure" | "rental_brochure";
  agencyAgents?: AgentProfile[];
  availableTemplates?: TemplatesResponse;
  onContinue: (collateral: CollateralItem) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () =>
      collateral.template_id ??
      availableTemplates?.default_template_id ??
      resolveCollateralTemplateId(agency, collateral),
  );
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasContent = Boolean(
    collateral.document_json && isBrochureDocument(collateral.document_json),
  );
  const buildPreview = useCallback(
    (templateId: string) => {
      const existing = collateral.document_json;
      return existing && isBrochureDocument(existing)
        ? { ...existing, template_id: templateId }
        : buildBrochureTemplatePreview({
            agency,
            listing,
            collateral,
            templateId,
            collateralType,
          });
    },
    [agency, listing, collateral, collateralType],
  );

  async function proceed() {
    if (saving || !ready) return;
    setSaving(true);
    onBusyChange(true);
    setError(null);
    let next = collateral;
    try {
      if (selectedTemplateId !== collateral.template_id) {
        const response = await fetch(`/api/collateral/${collateral.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: selectedTemplateId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.collateral)
          throw new Error(payload.error ?? "Unable to save design. Try again.");
        next = payload.collateral;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save design. Try again.",
      );
      setSaving(false);
      onBusyChange(false);
      return;
    }
    setSaving(false);
    onBusyChange(false);
    onContinue(next);
  }

  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title="Choose your brochure design"
        description="See your property in each layout. Choose one or two pages, then make it yours."
      >
        <button
          type="button"
          className="du-btn du-btn-sm du-btn-primary min-h-11"
          disabled={!ready || saving}
          onClick={() => void proceed()}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {saving
            ? "Saving design…"
            : hasContent
              ? "Use design & edit brochure"
              : "Use design & generate brochure"}
          {!saving ? (
            <ArrowRight className="size-4" aria-hidden="true" />
          ) : null}
        </button>
      </DocumentStepHeader>
      {error ? (
        <p role="alert" className="du-alert du-alert-error du-alert-soft">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <DocumentTemplateGallery
          product={collateralType}
          initialTemplates={availableTemplates}
          value={selectedTemplateId}
          onChange={setSelectedTemplateId}
          onReady={setReady}
          disabled={saving}
          filterByPages
          description="Your branding, photos and agent details are included. You can change the design later without rewriting your brochure."
          renderPreview={(id) => (
            <FittedBrochurePreview
              document={buildPreview(id)}
              listing={listing}
              agencyAgents={agencyAgents}
              useDocumentBrand
              thumbnail
              fitToWidth={false}
              maxHeight="170px"
              className="rounded-none border-0 shadow-none"
            />
          )}
        />
        <div className="min-w-0 space-y-3 xl:sticky xl:top-32">
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>YOUR PROPERTY · DESIGN PREVIEW</span>
            <span>{hasContent ? "Your saved content" : "Sample wording"}</span>
          </div>
          <FittedBrochurePreview
            document={buildPreview(selectedTemplateId)}
            listing={listing}
            agencyAgents={agencyAgents}
            useDocumentBrand
            pageLabels={["Cover", "Property details"]}
            maxHeight="min(82vh, 960px)"
          />
        </div>
      </div>
    </section>
  );
}
