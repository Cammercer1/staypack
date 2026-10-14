"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Popover } from "@base-ui/react/popover";
import { ArrowRight, RefreshCw, Check, Plus, X, Info, Waves, Snowflake, CarFront, Sparkles, Wallet, BedDouble, Bath, Users } from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { avmPriceSuggestion } from "@/lib/listings/pricing";
import { calculateAccommodates, formatCurrency } from "@/lib/reports/formatters";
import { calculateStrGrossYield, formatStrGrossYield } from "@/lib/reports/calculateStrYield";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import { STR_AMENITIES, identifyStrAmenity, importedStrAmenities, readStrPropertyContext, strPropertyContextSchema, suggestedWeeklyRent, type StrAmenityId } from "@/lib/str/propertyInputs";
import type { Listing, Report } from "@/lib/types";

const propertySchema = strPropertyContextSchema.extend({
  bedrooms: z.number().int().min(0, "Enter the bedroom count").max(20),
  bathrooms: z.number().min(0.5, "Enter the bathroom count").max(20),
  car_spaces: z.number().int("Enter a whole number of car spaces").min(0, "Car spaces cannot be negative").max(20, "Enter 20 car spaces or fewer").nullable(),
  accommodates: z.number().int().min(1, "Enter the guest capacity").max(30),
});
export type StrPropertyValues = z.infer<typeof propertySchema>;
export type StrPropertyHandle = { read: () => Promise<{ values: StrPropertyValues; profile: Listing } | null> };

export const StrPropertyStep = forwardRef<StrPropertyHandle, {
  listing: Listing; report: Report; busy: boolean; onContinue: () => void;
}>(function StrPropertyStep({ listing, report, busy, onContinue }, ref) {
  const savedContext = useRef(strPropertyContextSchema.safeParse(report.user_overrides_json?.strProperty).success);
  const savedPropertyValue = useRef(report.user_overrides_json?.strProperty?.propertyValue !== undefined);
  const edited = useRef(new Set<string>());
  const latestProfile = useRef(listing);
  const pending = useRef<Promise<void> | null>(null);
  const [profile, setProfile] = useState(listing);
  const [loading, setLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [additional, setAdditional] = useState("");
  const [amenityError, setAmenityError] = useState<string | null>(null);
  const { register, control, trigger, getValues, setValue, resetField, formState: { errors } } = useForm<StrPropertyValues>({
    resolver: zodResolver(propertySchema), mode: "onChange",
    defaultValues: {
      ...readStrPropertyContext(listing, report),
      bedrooms: listing.bedrooms ?? undefined, bathrooms: listing.bathrooms ?? undefined,
      car_spaces: listing.car_spaces ?? null,
      accommodates: calculateAccommodates(listing.bedrooms, listing.accommodates),
    },
  });
  const values = useWatch({ control });
  const annualRent = typeof values.weeklyRent === "number" && Number.isFinite(values.weeklyRent) && values.weeklyRent > 0 && values.weeklyRent <= 50_000 ? values.weeklyRent * 52 : null;
  const propertyValue = values.propertyValue;
  const rentalYield = calculateStrGrossYield(typeof propertyValue === "number" && Number.isFinite(propertyValue) && propertyValue > 0 && propertyValue <= 1_000_000_000 ? String(propertyValue) : null, annualRent);
  const selected = values.amenities ?? [];
  const extras = values.additionalAmenities ?? [];
  const imported = importedStrAmenities(profile);
  const rentSuggestion = suggestedWeeklyRent(profile);
  const valuation = avmPriceSuggestion(profile, "sale");
  const valuationBand = profile.scraped_listing_json?.domainAvm?.valuation;
  const otherFeatures = [...new Set(profile.scraped_listing_json?.propertyLookup?.features ?? [])].filter((feature) => !identifyStrAmenity(feature));

  const loadProfile = useCallback((refresh = false) => {
    if (pending.current) return pending.current;
    setLoading(true); setProfileError(null);
    pending.current = reportRequest<{ listing: Listing }>(`/api/listings/${listing.id}/property-profile`, jsonRequest({ refresh }))
      .then(({ listing: fetched }) => {
        if (!fetched?.id) throw new Error("Property details are unavailable. You can enter them manually.");
        latestProfile.current = fetched; setProfile(fetched);
        if (!edited.current.has("car_spaces")) resetField("car_spaces", { defaultValue: fetched.car_spaces ?? null });
        if (!savedPropertyValue.current && !edited.current.has("propertyValue")) resetField("propertyValue", { defaultValue: avmPriceSuggestion(fetched, "sale")?.value ?? null });
        if (!savedContext.current) {
          if (!edited.current.has("weeklyRent")) resetField("weeklyRent", { defaultValue: suggestedWeeklyRent(fetched)?.value ?? null });
          if (!edited.current.has("amenities")) setValue("amenities", importedStrAmenities(fetched));
        }
      })
      .catch((cause) => setProfileError(cause instanceof Error ? cause.message : "Property details are unavailable. You can enter them manually."))
      .finally(() => { pending.current = null; setLoading(false); });
    return pending.current;
  }, [listing.id, resetField, setValue]);
  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useImperativeHandle(ref, () => ({ read: async () => {
    await pending.current;
    if (additional.trim() && !addAmenity()) return null;
    if (!await trigger()) return null;
    return { values: propertySchema.parse(getValues()), profile: latestProfile.current };
  } }));

  function toggleAmenity(id: StrAmenityId) {
    edited.current.add("amenities");
    setValue("amenities", selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id], { shouldDirty: true, shouldValidate: true });
  }
  function addAmenity(text = additional) {
    const value = text.trim();
    if (!value) return true;
    if (value.length > 80) { setAmenityError("Keep each amenity under 80 characters."); return false; }
    const recognised = identifyStrAmenity(value);
    if (recognised) {
      if (!selected.includes(recognised)) toggleAmenity(recognised);
    } else if (!extras.some((item) => item.toLowerCase() === value.toLowerCase())) {
      if (extras.length >= 20) { setAmenityError("You can add up to 20 extra amenities."); return false; }
      setValue("additionalAmenities", [...extras, value], { shouldDirty: true, shouldValidate: true });
    }
    setAdditional(""); setAmenityError(null);
    return true;
  }
  function amenityButtons(items: readonly (typeof STR_AMENITIES)[number][]) {
    return items.map((item) => {
      const active = selected.includes(item.id);
      const Icon = item.id === "pool" || item.id === "hot_tub" ? Waves : item.id === "air_conditioning" ? Snowflake : item.id === "free_parking_on_premises" ? CarFront : Sparkles;
      return <button key={item.id} type="button" aria-label={item.label} aria-pressed={active} onClick={() => toggleAmenity(item.id)} className={active ? "du-btn du-btn-sm du-btn-primary h-auto min-h-12 justify-start whitespace-normal rounded-xl px-3 py-2 text-left" : "du-btn du-btn-sm du-btn-outline h-auto min-h-12 justify-start whitespace-normal rounded-xl px-3 py-2 text-left"}>
        <Icon className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{item.label}{imported.includes(item.id) && <span className="block text-[11px] font-normal opacity-80">Imported</span>}</span>
        {active && <Check className="size-4 shrink-0" aria-hidden="true" />}
      </button>;
    });
  }
  const primaryAmenities = STR_AMENITIES.filter((item, index) => index < 8 || selected.includes(item.id));
  const moreAmenities = STR_AMENITIES.filter((item) => !primaryAmenities.includes(item));

  return <section data-theme="staypack-workspace" className="space-y-5">
    <DocumentStepHeader title="Confirm the property" description="Start with the property, its rental potential and the guest experience you’re appraising.">
      <button type="button" className="du-btn du-btn-sm du-btn-primary min-h-11 h-auto py-3 whitespace-normal" disabled={busy} onClick={onContinue}>
        {report.final_estimate_json ? "Review estimate & evidence" : "Get estimate & evidence"}<ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </button>
    </DocumentStepHeader>
    <fieldset disabled={busy} className="du-card du-card-border min-w-0 bg-base-100">
      <div className="du-card-body gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="du-card-title text-base">The property</h3><p className="mt-1 text-sm text-base-content/70">{[listing.property_address?.split(",")[0].trim(), listing.suburb].filter(Boolean).join(", ")}</p></div>
          <button type="button" onClick={() => void loadProfile(true)} disabled={loading} className="du-btn du-btn-sm du-btn-ghost min-h-11"><RefreshCw className={loading ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} aria-hidden="true" />{loading ? "Checking property…" : "Refresh property details"}</button>
        </div>
        {profileError ? <p role="status" className="rounded-lg bg-base-200 p-3 text-sm">{profileError} Your own entries are kept.</p> : <p role="status" className="text-xs text-base-content/65">{loading ? "Bringing in estimated value, rental and amenity information. You can keep editing." : "Review imported details and make any corrections below."}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {([["bedrooms", "Bedrooms", BedDouble], ["bathrooms", "Bathrooms", Bath], ["car_spaces", "Car spaces", CarFront], ["accommodates", "Guest capacity", Users]] as const).map(([field, label, Icon]) => <div key={field} className="min-w-0 space-y-1.5">
            <label htmlFor={`str-${field}`} className="flex min-h-10 items-start gap-1.5 text-sm font-medium sm:min-h-0 sm:items-center"><Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />{label}</label>
            <input id={`str-${field}`} aria-label={label} type="number" inputMode="decimal" step={field === "bathrooms" ? "0.5" : "1"} min={field === "bedrooms" || field === "car_spaces" ? 0 : field === "bathrooms" ? 0.5 : 1} max={field === "accommodates" ? 30 : 20} className="du-input du-input-sm min-h-11 w-full" aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `str-${field}-error` : undefined} {...register(field, field === "car_spaces" ? { setValueAs: (value) => value == null || value === "" ? null : Number(value), onChange: () => edited.current.add("car_spaces") } : { valueAsNumber: true })} />
            {errors[field] && <p id={`str-${field}-error`} role="alert" className="text-sm text-error">{errors[field]?.message}</p>}
          </div>)}
        </div>
        <p className="text-xs text-base-content/65">Guest capacity is the number of overnight guests the property can comfortably accommodate. Changing bedrooms, bathrooms or guest capacity refreshes the STR estimate. Leave car spaces blank if unknown; enter 0 for none.</p>
        <div className="border-t border-base-300 pt-5">
          <div className="mb-4 space-y-2">
            <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Wallet className="size-4" aria-hidden="true" />Property value & long-term rent <span className="du-badge du-badge-sm du-badge-ghost">Recommended</span></h4>
            <p className="text-sm text-base-content/70">Add both to compare long-term rent, estimated gross STR revenue and your professionally managed scenario. Estimated property value provides the basis for gross yield comparisons.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label htmlFor="str-property-value" className="text-sm font-medium">Estimated property value ($)</label>
              <input id="str-property-value" type="number" inputMode="decimal" min="1" max="1000000000" step="any" className="du-input du-input-sm min-h-11 w-full" placeholder="e.g. 1200000" aria-invalid={Boolean(errors.propertyValue)} aria-describedby="str-value-help" {...register("propertyValue", { setValueAs: (value) => value == null || value === "" ? null : Number(value), onChange: () => edited.current.add("propertyValue") })} />
              {errors.propertyValue && <p role="alert" className="text-sm text-error">Enter an estimated value between $1 and $1 billion, or leave it blank.</p>}
              <p id="str-value-help" className="text-xs text-base-content/65">{valuation ? "An estimated property value is available below. Use it or enter your own appraisal." : "An estimated property value is unavailable. Enter your own property value estimate, or add it later."} Saved for this appraisal’s yield comparisons.</p>
              {valuation && <p className="rounded-lg bg-base-200 px-3 py-2 text-xs leading-relaxed">Property estimate: <strong>{valuation.display}</strong>{valuationBand ? ` · range ${formatCurrency(valuationBand.lowerPrice)}–${formatCurrency(valuationBand.upperPrice)}` : ""}{valuation.date ? ` · ${valuation.date}` : ""}{valuation.confidence ? ` · ${valuation.confidence} confidence` : ""}.</p>}
            </div>
            <div className="min-w-0 space-y-2">
              <label htmlFor="str-weekly-rent" className="text-sm font-medium">Long-term rent ($ / week)</label>
              <input id="str-weekly-rent" type="number" inputMode="decimal" min="1" max="50000" step="1" className="du-input du-input-sm min-h-11 w-full" placeholder="e.g. 850" aria-invalid={Boolean(errors.weeklyRent)} aria-describedby="str-rent-help" {...register("weeklyRent", { setValueAs: (value) => value == null || value === "" ? null : Number(value), onChange: () => edited.current.add("weeklyRent") })} />
              {errors.weeklyRent && <p role="alert" className="text-sm text-error">Enter a weekly rent greater than zero, or leave it blank.</p>}
              <p id="str-rent-help" className="text-xs text-base-content/65">{rentSuggestion ? `${rentSuggestion.source}: ${formatCurrency(rentSuggestion.value)} / week${rentSuggestion.date ? ` · ${rentSuggestion.date}` : ""}. Edit to use your own appraisal.` : "Add your expected long-term weekly rent to compare with short-term rental revenue."}</p>
              {annualRent !== null && <p className="text-sm font-medium">{formatCurrency(annualRent)} / year <span className="font-normal text-base-content/65">before costs</span></p>}
              {rentalYield && <div className="flex items-center gap-1 text-xs text-base-content/70">
                <span aria-live="polite">Estimated gross LTR yield: {formatStrGrossYield(rentalYield)}</span>
                <Popover.Root>
                  <Popover.Trigger openOnHover aria-label="How LTR yield is calculated" className="du-btn du-btn-sm du-btn-ghost du-btn-circle size-11 shrink-0">
                    <Info className="size-4" aria-hidden="true" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner side="top" align="end" sideOffset={8} className="z-50">
                      <Popover.Popup data-theme="staypack-workspace" className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-base-300 bg-base-100 p-4 text-sm text-base-content shadow-lg outline-none">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Popover.Title className="font-semibold">Estimated gross LTR yield</Popover.Title>
                          <Popover.Close aria-label="Close yield explanation" className="du-btn du-btn-sm du-btn-ghost du-btn-circle size-11 shrink-0"><X className="size-4" aria-hidden="true" /></Popover.Close>
                        </div>
                        <Popover.Description className="leading-relaxed text-base-content/70">Based on 52 weeks’ rent and the estimated property value, before vacancy, expenses and purchase costs. This is a comparison guide, not a guaranteed return.</Popover.Description>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </div>}
            </div>
          </div>
        </div>
      </div>
    </fieldset>
    <fieldset disabled={busy} className="du-card du-card-border min-w-0 bg-base-100">
      <div className="du-card-body gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="du-card-title text-base">What can guests enjoy?</h3><span className="du-badge du-badge-sm du-badge-ghost">{selected.length + extras.length} selected</span></div>
        <p className="text-sm text-base-content/70">Recognised imported amenities are selected for you. Review what guests can use, remove anything unavailable, and add what’s missing. Check shared facilities and anything you plan to add.</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Property amenities">{amenityButtons(primaryAmenities)}</div>
        {moreAmenities.length > 0 && <details className="rounded-xl border border-base-300 p-3"><summary className="cursor-pointer py-1 text-sm font-medium">More amenities</summary><div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{amenityButtons(moreAmenities)}</div></details>}
        {extras.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Additional amenities">{extras.map((item) => <li key={item} className="flex max-w-full items-center gap-1 rounded-xl bg-base-200 pl-3 text-sm"><span className="break-words">{item}</span><button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11 min-w-11 shrink-0" aria-label={`Remove ${item}`} onClick={() => setValue("additionalAmenities", extras.filter((value) => value !== item), { shouldDirty: true })}><X className="size-4" aria-hidden="true" /></button></li>)}</ul>}
        <div className="space-y-2 border-t border-base-300 pt-4">
          <label htmlFor="str-add-amenity" className="text-sm font-medium">Add another amenity</label>
          <div className="flex gap-2"><input id="str-add-amenity" value={additional} onChange={(event) => { setAdditional(event.target.value); setAmenityError(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAmenity(); } }} maxLength={80} className="du-input du-input-sm min-h-11 min-w-0 flex-1" placeholder="e.g. Private tennis court" /><button type="button" disabled={!additional.trim()} className="du-btn du-btn-sm min-h-11" onClick={() => addAmenity()}><Plus className="size-4" aria-hidden="true" />Add</button></div>
          {amenityError && <p role="alert" className="text-sm text-error">{amenityError}</p>}
        </div>
        {otherFeatures.length > 0 && <details className="text-sm"><summary className="cursor-pointer py-2 font-medium">Other imported features ({otherFeatures.length})</summary><p className="mb-2 text-xs text-base-content/65">Add only the features relevant to a guest’s stay.</p><div className="flex flex-wrap gap-2">{otherFeatures.map((feature) => <button type="button" key={feature} disabled={extras.some((item) => item.toLowerCase() === feature.toLowerCase())} className="du-btn du-btn-sm min-h-11 h-auto max-w-full whitespace-normal py-2" onClick={() => addAmenity(feature)}><Plus className="size-3.5 shrink-0" aria-hidden="true" />{feature}</button>)}</div></details>}
        <p className="text-xs leading-relaxed text-base-content/65">Selected amenities help prioritise comparable stays in the next step. Extra amenities are saved with this appraisal. They don’t automatically add a percentage to estimated revenue; review their impact alongside the evidence.</p>
      </div>
    </fieldset>
  </section>;
});
