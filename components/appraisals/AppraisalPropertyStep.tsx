"use client";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forwardRef, useImperativeHandle, useState } from "react";
import { appraisalPropertySchema } from "@/lib/appraisals/workspaceInputs";
import { getListingImagePool } from "@/lib/listings/collateralImages";
import { proposalFetch } from "@/components/digital-proposals/ProposalWorkspaceControls";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import type { Listing } from "@/lib/types";
import type { WorkspaceAppraisal } from "@/lib/appraisals/workspaceTypes";
export const AppraisalPropertyStep = forwardRef<{ save: () => Promise<boolean> }, { listing: Listing; appraisal: WorkspaceAppraisal; onSaved: (value: { listing: Listing; appraisal: WorkspaceAppraisal }) => void; onBusyChange: (busy: boolean) => void; onContinue: () => void; }>(function AppraisalPropertyStep({ listing, appraisal, onSaved, onBusyChange, onContinue }, ref) {
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof appraisalPropertySchema>>({ resolver: zodResolver(appraisalPropertySchema), defaultValues: {
    property_address: listing.property_address ?? "", suburb: listing.suburb ?? "", state: listing.state ?? "", postcode: listing.postcode ?? "",
    property_type: listing.property_type ?? "", bedrooms: listing.bedrooms ?? 0, bathrooms: listing.bathrooms ?? 0, car_spaces: listing.car_spaces ?? null,
    listing_description: listing.listing_description ?? "", ...(listing.hero_image_url ? { hero_image_url: listing.hero_image_url } : {}),
  } });
  const photos = getListingImagePool(listing);
  async function save() {
    let saved = false;
    await form.handleSubmit(async property => {
    if (!form.formState.isDirty) { saved = true; return; }
    onBusyChange(true); setError("");
    try { const result = await proposalFetch<{ listing: Listing; appraisal: WorkspaceAppraisal }>(`/api/appraisals/${appraisal.report_id}/property`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ property, expected_updated_at: appraisal.updated_at }) }); form.reset(property); onSaved(result); saved = true; }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Unable to save property details."); }
    finally { onBusyChange(false); }
    })();
    return saved;
  }
  useImperativeHandle(ref, () => ({ save }));
  return <form className="space-y-6" onSubmit={event => { event.preventDefault(); void save().then(saved => { if (saved) onContinue(); }); }}>
    <UnsavedListingGuard dirty={form.formState.isDirty} description="Save this appraisal's property details before leaving." />
    <p className="text-sm text-base-content/65">These details belong to this appraisal. Your shared property and its brochures keep their existing details.</p>
    <fieldset disabled={form.formState.isSubmitting} className="grid gap-5 sm:grid-cols-2">
      {([['property_address','Property address'],['suburb','Suburb'],['state','State'],['postcode','Postcode'],['property_type','Property type']] as const).map(([key,label]) => <label className="block text-sm" key={key}>{label}<input className="du-input mt-2 w-full" {...form.register(key)} />{form.formState.errors[key] && <span role="alert" className="mt-1 block text-error">{form.formState.errors[key]?.message}</span>}</label>)}
      <div className="grid grid-cols-3 gap-3">{([['bedrooms','Bedrooms'],['bathrooms','Bathrooms'],['car_spaces','Car spaces']] as const).map(([key,label]) => <label className="text-sm" key={key}>{label}<input type="number" min={key === "bedrooms" ? 1 : 0} className="du-input mt-2 w-full" {...form.register(key, key === "car_spaces" ? { setValueAs: value => value == null || value === "" ? null : Number(value) } : { valueAsNumber: true })} />{form.formState.errors[key] && <span role="alert" className="text-error">{form.formState.errors[key]?.message}</span>}</label>)}</div>
      <label className="text-sm sm:col-span-2">Property description<textarea className="du-textarea mt-2 min-h-28 w-full" {...form.register("listing_description")} /></label>
      {photos.length > 0 && <div className="sm:col-span-2"><label htmlFor="appraisal-cover" className="block text-sm">Cover photograph</label><select id="appraisal-cover" className="du-select mt-2 w-full" {...form.register("hero_image_url")}>{photos.map((url,index) => <option key={url} value={url}>Photo {index+1}</option>)}</select><div className="mt-4 flex gap-3 overflow-x-auto">{photos.slice(0,12).map((url,index) => <figure key={url} className="shrink-0"><Image unoptimized src={url} alt={`Property photo ${index+1}`} width={160} height={110} className="h-24 w-36 rounded-lg object-cover" /><figcaption className="mt-1 text-xs">Photo {index+1}</figcaption></figure>)}</div></div>}
    </fieldset>
    {error && <p role="alert" className="text-error">{error}</p>}
    <div className="flex justify-end"><button className="du-btn du-btn-primary min-h-12" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Continue to evidence"}</button></div>
  </form>;
});
