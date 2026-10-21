"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { appraisalPropertySchema } from "@/lib/appraisals/workspaceInputs";
import { proposalFetch } from "@/components/digital-proposals/ProposalWorkspaceControls";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { AppraisalStepHeader } from "./AppraisalStepHeader";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";
import type { WorkspaceAppraisal } from "@/lib/appraisals/workspaceTypes";
export const AppraisalPropertyStep = forwardRef<{ save: () => Promise<boolean> }, { listing: Listing; appraisal: WorkspaceAppraisal; onSaved: (value: { listing: Listing; appraisal: WorkspaceAppraisal }) => void; onBusyChange: (busy: boolean) => void; onContinue: () => void; }>(function AppraisalPropertyStep({ listing, appraisal, onSaved, onBusyChange, onContinue }, ref) {
  const [error, setError] = useState("");
  const id = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const saving = useRef(false);
  const form = useForm<z.infer<typeof appraisalPropertySchema>>({ resolver: zodResolver(appraisalPropertySchema), defaultValues: {
    property_address: listing.property_address ?? "", suburb: listing.suburb ?? "", state: listing.state ?? "", postcode: listing.postcode ?? "",
    property_type: listing.property_type ?? "", bedrooms: listing.bedrooms ?? 0, bathrooms: listing.bathrooms ?? 0, car_spaces: listing.car_spaces ?? null,
    listing_description: listing.listing_description ?? "", ...(listing.hero_image_url ? { hero_image_url: listing.hero_image_url } : {}),
  } });
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView?.({ block: "center" });
      errorRef.current?.focus({ preventScroll: true });
    }
  }, [error, form.formState.submitCount]);
  async function save() {
    if (saving.current) return false;
    saving.current = true;
    let saved = false;
    setError("");
    try {
      await form.handleSubmit(async property => {
        if (!form.formState.isDirty) { saved = true; return; }
        onBusyChange(true);
        try { const result = await proposalFetch<{ listing: Listing; appraisal: WorkspaceAppraisal }>(`/api/appraisals/${appraisal.report_id}/property`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ property, expected_updated_at: appraisal.updated_at }) }); form.reset(property); onSaved(result); saved = true; }
        catch(cause) { setError(cause instanceof Error ? cause.message : "Unable to save property details."); }
        finally { onBusyChange(false); }
      })();
    } finally { saving.current = false; }
    return saved;
  }
  useImperativeHandle(ref, () => ({ save }));
  const errors = form.formState.errors;
  const continueAction = <button type="submit" className="du-btn du-btn-sm du-btn-primary h-auto min-h-12 whitespace-normal py-3" disabled={form.formState.isSubmitting}>
    {form.formState.isSubmitting ? "Saving…" : "Continue to review estimate"}<ArrowRight className="size-4 shrink-0" aria-hidden="true" />
  </button>;
  return <form data-theme="staypack-workspace" noValidate className="space-y-5 text-base-content" onSubmit={event => { event.preventDefault(); void save().then(saved => { if (saved) onContinue(); }); }}>
    <UnsavedListingGuard dirty={form.formState.isDirty} description="Save this appraisal's property details before leaving." />
    <AppraisalStepHeader title="Confirm property" description="Changes apply to this appraisal only.">{continueAction}</AppraisalStepHeader>
    {error && <p ref={errorRef} role="alert" tabIndex={-1} className="du-alert du-alert-error du-alert-soft">{error}</p>}
    <fieldset disabled={form.formState.isSubmitting} className="du-card du-card-border min-w-0 bg-base-100">
      <div className="du-card-body grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        {([['property_address','Property address'],['suburb','Suburb'],['state','State'],['postcode','Postcode'],['property_type','Property type']] as const).map(([key,label]) => <div className="text-sm" key={key}>
          <label htmlFor={`${id}-${key}`}>{label}</label>
          <input id={`${id}-${key}`} className={cn("du-input mt-2 w-full", errors[key] && "du-input-error")} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-${key}-error` : undefined} {...form.register(key)} />
          {errors[key] && <span id={`${id}-${key}-error`} role="alert" className="mt-1 block text-error">{errors[key]?.message}</span>}
        </div>)}
        <div className="grid grid-cols-3 gap-3">{([['bedrooms','Bedrooms'],['bathrooms','Bathrooms'],['car_spaces','Car spaces']] as const).map(([key,label]) => <div className="min-w-0 text-sm" key={key}>
          <label htmlFor={`${id}-${key}`}>{label}</label>
          <input id={`${id}-${key}`} type="number" min={key === "bedrooms" ? 1 : 0} className={cn("du-input mt-2 w-full", errors[key] && "du-input-error")} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-${key}-error` : undefined} {...form.register(key, key === "car_spaces" ? { setValueAs: value => value == null || value === "" ? null : Number(value) } : { valueAsNumber: true })} />
          {errors[key] && <span id={`${id}-${key}-error`} role="alert" className="mt-1 block text-error">{errors[key]?.message}</span>}
        </div>)}</div>
        <div className="text-sm sm:col-span-2">
          <label htmlFor={`${id}-description`}>Property description <span className="text-xs text-base-content/60">(Optional)</span></label>
          <textarea id={`${id}-description`} aria-label="Property description" rows={3} className={cn("du-textarea mt-2 min-h-24 w-full", errors.listing_description && "du-textarea-error")} aria-invalid={Boolean(errors.listing_description)} aria-describedby={errors.listing_description ? `${id}-description-error` : undefined} {...form.register("listing_description")} />
          {errors.listing_description && <span id={`${id}-description-error`} role="alert" className="mt-1 block text-error">{errors.listing_description.message}</span>}
        </div>
      </div>
    </fieldset>
    <div className="flex justify-end">{continueAction}</div>
  </form>;
});
