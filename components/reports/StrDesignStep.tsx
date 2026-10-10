"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { AppraisalTemplateGallery } from "@/components/appraisals/AppraisalTemplateGallery";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import { buildStrTemplatePreview } from "@/lib/reports/templatePreviewDocument";
import {
  normalizeAdvertisedPrice,
  resolveAdvertisedPrice,
} from "@/lib/listings/pricing";
import { calculateAccommodates } from "@/lib/reports/formatters";
import { resolveReportTemplateIdForReport } from "@/lib/reports/templateFromEstimateTier";
import type { Agency, AgentProfile, Listing, Report } from "@/lib/types";

const propertySchema = z.object({
  bedrooms: z.number().int().min(0, "Enter the bedroom count").max(50),
  bathrooms: z.number().min(0.5, "Enter the bathroom count").max(50),
  accommodates: z.number().int().min(1, "Enter the guest capacity").max(100),
  display_price: z
    .string()
    .trim()
    .refine(
      (value) => !value || normalizeAdvertisedPrice(value, "sale") !== null,
      "Enter a sale price, not weekly rent",
    ),
});
export type StrDesignValues = z.infer<typeof propertySchema> & {
  templateId: string;
};
export type StrDesignHandle = { read: () => Promise<StrDesignValues | null> };

export const StrDesignStep = forwardRef<
  StrDesignHandle,
  {
    agency: Agency;
    agencyAgents: AgentProfile[];
    listing: Listing;
    report: Report;
    availableTemplates?: TemplatesResponse;
    busy: boolean;
    onContinue: () => void;
  }
>(function StrDesignStep(
  {
    agency,
    agencyAgents,
    listing,
    report,
    availableTemplates,
    busy,
    onContinue,
  },
  ref,
) {
  const [templateId, setTemplateId] = useState(() =>
    resolveReportTemplateIdForReport(agency, report),
  );
  const [ready, setReady] = useState(false);
  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof propertySchema>>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      bedrooms: listing.bedrooms ?? undefined,
      bathrooms: listing.bathrooms ?? undefined,
      accommodates: calculateAccommodates(
        listing.bedrooms,
        listing.accommodates,
      ),
      display_price: resolveAdvertisedPrice(listing, "sale") ?? "",
    },
  });
  useImperativeHandle(ref, () => ({
    read: async () =>
      ready && (await trigger()) ? { ...getValues(), templateId } : null,
  }));
  const previewForTemplate = (id: string) =>
    buildStrTemplatePreview({
      agency,
      agencyAgents,
      listing,
      report,
      templateId: id,
    });
  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title="Choose your report design"
        description="Check the property details, choose a layout, then review its short-term rental potential."
      >
        <button
          type="button"
          className="du-btn du-btn-primary min-h-11 h-auto py-3 whitespace-normal"
          disabled={busy || !ready}
          onClick={onContinue}
        >
          {report.final_estimate_json
            ? "Use design & review estimate"
            : "Use design & get estimate"}
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </DocumentStepHeader>
      <fieldset
        disabled={busy}
        className="du-card du-card-border min-w-0 bg-base-100"
      >
        <div className="du-card-body gap-4 p-5">
          <div>
            <h3 className="du-card-title text-base">Confirm the property</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {listing.property_address}, {listing.suburb}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["bedrooms", "Bedrooms"],
                ["bathrooms", "Bathrooms"],
                ["accommodates", "Guest capacity"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="min-w-0 space-y-1.5">
                <label htmlFor={`str-${field}`} className="text-sm font-medium">
                  {label}
                </label>
                <input
                  id={`str-${field}`}
                  aria-label={label}
                  type="number"
                  inputMode="decimal"
                  step={field === "bathrooms" ? "0.5" : "1"}
                  min={
                    field === "bedrooms" ? 0 : field === "bathrooms" ? 0.5 : 1
                  }
                  className="du-input w-full"
                  aria-invalid={Boolean(errors[field])}
                  aria-describedby={
                    errors[field] ? `str-${field}-error` : undefined
                  }
                  {...register(field, { valueAsNumber: true })}
                />
                {errors[field] ? (
                  <p
                    id={`str-${field}-error`}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors[field]?.message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Guest capacity is the number of overnight guests the property can
            comfortably accommodate. Changing these details refreshes the
            estimate.
          </p>
          <div className="max-w-md space-y-1.5">
            <label htmlFor="str-price" className="text-sm font-medium">
              Advertised sale price{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              id="str-price"
              className="du-input w-full"
              placeholder="e.g. $1,200,000"
              aria-describedby="str-price-help"
              {...register("display_price")}
            />
            {errors.display_price ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.display_price.message}
              </p>
            ) : null}
            <p id="str-price-help" className="text-xs text-muted-foreground">
              A numeric sale price lets the report show an estimated gross STR
              revenue comparison to price. Leave blank if a sale price is not
              relevant.
            </p>
          </div>
        </div>
      </fieldset>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <AppraisalTemplateGallery
          product="str"
          initialTemplates={availableTemplates}
          value={templateId}
          onChange={setTemplateId}
          previewForTemplate={previewForTemplate}
          disabled={busy}
          onReady={setReady}
        />
        <div className="min-w-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your property · Design preview
            {!report.ai_copy_json ? " · Sample wording" : ""}
          </p>
          <FittedReportPreview
            pageLabels={["Overview", "Market evidence"]}
            report={previewForTemplate(templateId)}
            maxHeight="min(75vh, 850px)"
            fitToWidth
          />
          {!report.final_estimate_json ? (
            <p className="text-xs text-muted-foreground">
              Revenue figures appear after you get the estimate.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
});
