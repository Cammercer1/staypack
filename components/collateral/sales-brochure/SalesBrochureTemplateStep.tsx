"use client";

import { useCallback, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { DocumentTemplateGallery } from "@/components/documents/DocumentTemplateGallery";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { buildBrochureTemplatePreview } from "@/lib/collateral/sales-brochure/templatePreviewDocument";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import {
  isBrochureDocument,
  resolveBrochurePrice,
} from "@/lib/collateral/templates/types";
import {
  brochurePriceFormSchema,
  formatBrochurePrice,
  initialBrochurePrice,
} from "@/lib/collateral/sales-brochure/brochurePrice";
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
  initialPriceValue,
  onContinue,
  onBusyChange,
}: {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  collateralType?: "sales_brochure" | "rental_brochure";
  agencyAgents?: AgentProfile[];
  availableTemplates?: TemplatesResponse;
  initialPriceValue?: string;
  onContinue: (collateral: CollateralItem, priceValue: string) => void;
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
  const rental = collateralType === "rental_brochure";
  const priceId = useId();
  const savedPrice = initialBrochurePrice(listing, collateral);
  const documentPrice =
    collateral.document_json && isBrochureDocument(collateral.document_json)
      ? resolveBrochurePrice(collateral.document_json).trim()
      : "";
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(brochurePriceFormSchema),
    defaultValues: { price_value: initialPriceValue ?? savedPrice },
  });
  const priceValue = useWatch({ control, name: "price_value" });
  const previewPrice = formatBrochurePrice(priceValue, rental);
  const buildPreview = useCallback(
    (templateId: string) => {
      const existing = collateral.document_json;
      const preview = existing && isBrochureDocument(existing)
        ? { ...existing, template_id: templateId }
        : buildBrochureTemplatePreview({
            agency,
            listing,
            collateral,
            templateId,
            collateralType,
          });
      return {
        ...preview,
        copy: {
          ...preview.copy,
          price_value:
            previewPrice || (rental ? "Add weekly rent" : "Add sale price"),
        },
      };
    },
    [agency, listing, collateral, collateralType, previewPrice, rental],
  );

  async function proceed(priceValue: string) {
    if (saving || !ready) return;
    setSaving(true);
    onBusyChange(true);
    setError(null);
    let next = collateral;
    try {
      if (
        selectedTemplateId !== collateral.template_id ||
        (hasContent && priceValue !== documentPrice)
      ) {
        const response = await fetch(`/api/collateral/${collateral.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: selectedTemplateId,
            ...(hasContent ? { copy: { price_value: priceValue } } : {}),
          }),
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
    onContinue(next, priceValue);
  }

  return (
    <form
      data-theme="staypack-workspace"
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit(({ price_value }) =>
        proceed(formatBrochurePrice(price_value, rental)),
      )}
    >
      <DocumentStepHeader
        title="Choose your brochure design"
        description="See your property in each layout. Choose one or two pages, then make it yours."
      >
        <button
          type="submit"
          className="du-btn du-btn-sm du-btn-primary h-auto min-h-11 whitespace-normal py-2"
          disabled={!ready || saving}
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
      <section
        aria-labelledby={`${priceId}-heading`}
        className="rounded-xl border border-base-300 bg-base-100 p-4 sm:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-1">
            <h3 id={`${priceId}-heading`} className="text-base font-semibold">
              {rental ? "Set the weekly rent" : "Set the brochure price"}
            </h3>
            <p id={`${priceId}-help`} className="text-sm text-muted-foreground">
              {savedPrice
                ? "Check the price shown on your brochure. Changes here apply to this brochure only."
                : `No ${rental ? "weekly rent" : "sale price"} has been added. Enter it now so your brochure is ready to share.`}
            </p>
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor={priceId} className="block text-sm font-medium">
              {rental ? "Weekly rent" : "Sale price or guide"}
            </label>
            <input
              {...register("price_value")}
              id={priceId}
              type="text"
              maxLength={60}
              disabled={saving}
              aria-label={rental ? "Weekly rent" : "Sale price or guide"}
              aria-required="true"
              aria-invalid={Boolean(errors.price_value)}
              aria-describedby={`${priceId}-help${errors.price_value ? ` ${priceId}-error` : ""}`}
              placeholder={rental ? "e.g. $850 per week" : "e.g. $1,200,000 or Auction"}
              className={errors.price_value
                ? "du-input du-input-sm du-input-error min-h-11 w-full"
                : "du-input du-input-sm min-h-11 w-full"}
            />
            {errors.price_value ? (
              <p id={`${priceId}-error`} role="alert" className="text-sm text-error">
                {errors.price_value.message}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-muted-foreground">
                Prefer not to show an amount?
              </span>
              <button
                type="button"
                className="du-btn du-btn-sm du-btn-ghost min-h-11"
                disabled={saving}
                onClick={() =>
                  setValue("price_value", "Contact agent", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                Use “Contact agent”
              </button>
            </div>
          </div>
        </div>
      </section>
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
    </form>
  );
}
