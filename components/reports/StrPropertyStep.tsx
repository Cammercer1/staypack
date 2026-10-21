"use client";

import { marketForCountry, rentForPeriod, rentFromPeriod } from "@/lib/property-market";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Popover } from "@base-ui/react/popover";
import { ArrowRight, RefreshCw, Check, Plus, X, Info, Waves, Snowflake, CarFront, Sparkles, Wallet, BedDouble, Bath, Users } from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import { AppraisalStepPanel, AppraisalStepTabs } from "@/components/appraisals/AppraisalStepTabs";
import { CalculatorPropertyReview, type CalculatorPropertySelection } from "./CalculatorPropertyReview";
import { calculatorPropertyReviewKey } from "@/lib/str-calculator/propertyReviewIdentity";
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
  listing: Listing; report: Report; busy: boolean; onContinue: () => void; calculatorReview?: boolean;
}>(function StrPropertyStep({ listing, report, busy, onContinue, calculatorReview = false }, ref) {
  const market = marketForCountry(listing.country);
  const review = report.user_overrides_json?.calculatorReview;
  const detailsPropertyKey = review?.detailsPropertyKey ?? review?.propertyKey;
  const staleSavedContext = calculatorReview && detailsPropertyKey !== undefined && detailsPropertyKey !== calculatorPropertyReviewKey(listing);
  const savedContext = useRef(!staleSavedContext && strPropertyContextSchema.safeParse(report.user_overrides_json?.strProperty).success);
  const savedPropertyValue = useRef(!staleSavedContext && report.user_overrides_json?.strProperty?.propertyValue !== undefined);
  const edited = useRef(new Set<string>());
  const latestProfile = useRef(listing);
  const pending = useRef<Promise<Listing | null> | null>(null);
  const [profile, setProfile] = useState(listing);
  const [loading, setLoading] = useState(calculatorReview);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressUpdated, setAddressUpdated] = useState(false);
  const [additional, setAdditional] = useState("");
  const [amenityError, setAmenityError] = useState<string | null>(null);
  const [section, setSection] = useState("details");
  const [validationFocus, setValidationFocus] = useState<{ name: keyof StrPropertyValues } | null>(null);
  const handledValidationFocus = useRef<typeof validationFocus>(null);
  const additionalInput = useRef<HTMLInputElement>(null);
  const { register, control, trigger, getValues, getFieldState, setFocus, setValue, resetField, formState: { errors } } = useForm<StrPropertyValues>({
    resolver: zodResolver(propertySchema), mode: "onChange",
    defaultValues: {
      ...readStrPropertyContext(listing, staleSavedContext ? { user_overrides_json: null } : report),
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
  useEffect(() => {
    if (!validationFocus || busy || handledValidationFocus.current === validationFocus) return;
    handledValidationFocus.current = validationFocus;
    if (validationFocus.name === "amenities" || validationFocus.name === "additionalAmenities") additionalInput.current?.focus();
    else setFocus(validationFocus.name);
  }, [validationFocus, busy, setFocus]);

  const loadProfile = useCallback((refresh = false, selection: CalculatorPropertySelection = {}) => {
    if (pending.current) return pending.current;
    setLoading(true); setProfileError(null);
    pending.current = reportRequest<{ listing: Listing; profile_warning?: string; identity_changed?: boolean; address_corrected?: boolean }>(`/api/listings/${listing.id}/property-profile`, jsonRequest({ refresh, ...(calculatorReview ? { calculatorReview: true, reportId: report.id, ...selection } : {}) }))
      .then(({ listing: fetched, profile_warning, identity_changed, address_corrected }) => {
        if (!fetched?.id) throw new Error("Property details are unavailable. You can enter them manually.");
        latestProfile.current = fetched; setProfile(fetched);
        setProfileError(profile_warning ?? null);
        setAddressUpdated(Boolean(identity_changed || address_corrected));
        if (identity_changed) {
          savedContext.current = false; savedPropertyValue.current = false;
          // A different home must not inherit value, rent or amenities from the
          // previous address, including edits made before correcting the match.
          edited.current.clear();
          setValue("additionalAmenities", []);
          setAdditional(""); setAmenityError(null);
        }
        if (!edited.current.has("car_spaces")) resetField("car_spaces", { defaultValue: fetched.car_spaces ?? null });
        if (!savedPropertyValue.current && !edited.current.has("propertyValue")) resetField("propertyValue", { defaultValue: avmPriceSuggestion(fetched, "sale")?.value ?? null });
        if (!savedContext.current) {
          if (!edited.current.has("weeklyRent")) resetField("weeklyRent", { defaultValue: suggestedWeeklyRent(fetched)?.value ?? null });
          if (!edited.current.has("amenities")) setValue("amenities", importedStrAmenities(fetched));
        }
        return fetched;
      })
      .catch((cause) => { setProfileError(cause instanceof Error ? cause.message : "Property details are unavailable. You can enter them manually."); return null; })
      .finally(() => { pending.current = null; setLoading(false); });
    return pending.current;
  }, [listing.id, report.id, calculatorReview, resetField, setValue]);
  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useImperativeHandle(ref, () => ({ read: async () => {
    await pending.current;
    if (addressEditing) { setSection("details"); return null; }
    if (additional.trim() && !addAmenity()) {
      setSection("amenities"); setValidationFocus({ name: "additionalAmenities" }); return null;
    }
    if (!await trigger()) {
      const name = (["bedrooms", "bathrooms", "car_spaces", "accommodates", "propertyValue", "weeklyRent", "amenities", "additionalAmenities"] as const).find(field => getFieldState(field).error);
      if (name) {
        setSection(name === "amenities" || name === "additionalAmenities" ? "amenities" : "details");
        setValidationFocus({ name });
      }
      return null;
    }
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
  const continueAction = <button type="button" className="du-btn du-btn-sm du-btn-primary min-h-11 h-auto py-3 whitespace-normal" disabled={busy || (calculatorReview && (loading || addressEditing))} onClick={onContinue}>
    Continue to review estimate<ArrowRight className="size-4 shrink-0" aria-hidden="true" />
  </button>;

  return <section data-theme="staypack-workspace" className="space-y-5">
    <DocumentStepHeader title="Confirm the property" description={calculatorReview ? "Confirm the address and room counts from this enquiry." : "Check the property details and amenities."}>
      {continueAction}
    </DocumentStepHeader>
    <AppraisalStepTabs label="Property sections" value={section} onValueChange={setSection} disabled={busy} tabs={[{ value: "details", label: "Property details" }, { value: "amenities", label: "Amenities" }]}>
    <AppraisalStepPanel value="details">
    <fieldset disabled={busy} className="du-card du-card-border min-w-0 bg-base-100">
      <div className="du-card-body gap-5 p-5 sm:p-6">
        {calculatorReview ? <CalculatorPropertyReview profile={profile} loading={loading} error={profileError} addressUpdated={addressUpdated} onLookup={(selection) => loadProfile(true, selection)} onEditingChange={setAddressEditing} /> : <><div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="du-card-title text-base">The property</h3><p className="mt-1 text-sm text-base-content/70">{[listing.property_address?.split(",")[0].trim(), listing.suburb].filter(Boolean).join(", ")}</p></div>
          <button type="button" onClick={() => void loadProfile(true)} disabled={loading} className="du-btn du-btn-sm du-btn-ghost min-h-11"><RefreshCw className={loading ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} aria-hidden="true" />{loading ? "Checking property…" : "Refresh property details"}</button>
        </div>
        {profileError ? <p role="status" className="rounded-lg bg-base-200 p-3 text-sm">{profileError} Your own entries are kept.</p> : loading && <p role="status" className="text-xs text-base-content/65">Loading property details. You can keep editing.</p>}</>}
        {calculatorReview && !loading && profile.scraped_listing_json?.propertyLookup && (profile.scraped_listing_json.bedrooms !== undefined || profile.scraped_listing_json.bathrooms !== undefined) && <p className="rounded-lg bg-base-200 px-3 py-2 text-sm">Property record: {[profile.scraped_listing_json.bedrooms !== undefined ? `${profile.scraped_listing_json.bedrooms} bedroom${profile.scraped_listing_json.bedrooms === 1 ? "" : "s"}` : null, profile.scraped_listing_json.bathrooms !== undefined ? `${profile.scraped_listing_json.bathrooms} bathroom${profile.scraped_listing_json.bathrooms === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}. Check your enquiry’s room counts below.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {([["bedrooms", "Bedrooms", BedDouble], ["bathrooms", "Bathrooms", Bath], ["car_spaces", "Car spaces", CarFront], ["accommodates", "Guest capacity", Users]] as const).map(([field, label, Icon]) => <div key={field} className="min-w-0 space-y-1.5">
            <label htmlFor={`str-${field}`} className="flex min-h-10 items-start gap-1.5 text-sm font-medium sm:min-h-0 sm:items-center"><Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />{label}</label>
            <input id={`str-${field}`} aria-label={label} type="number" inputMode="decimal" step={field === "bathrooms" ? "0.5" : "1"} min={field === "bedrooms" || field === "car_spaces" ? 0 : field === "bathrooms" ? 0.5 : 1} max={field === "accommodates" ? 30 : 20} className="du-input du-input-sm min-h-11 w-full" aria-invalid={Boolean(errors[field])} aria-describedby={[errors[field] ? `str-${field}-error` : null, field === "accommodates" || field === "car_spaces" ? `str-${field}-help` : null].filter(Boolean).join(" ") || undefined} {...register(field, field === "car_spaces" ? { setValueAs: (value) => value == null || value === "" ? null : Number(value), onChange: () => edited.current.add("car_spaces") } : { valueAsNumber: true })} />
            {errors[field] && <p id={`str-${field}-error`} role="alert" className="text-sm text-error">{errors[field]?.message}</p>}
            {(field === "accommodates" || field === "car_spaces") && <p id={`str-${field}-help`} className="text-xs text-base-content/65">{field === "accommodates" ? "Overnight guests." : "Blank if unknown; 0 if none."}</p>}
          </div>)}
        </div>
        <p className="text-xs text-base-content/65">Changing bedrooms, bathrooms or guest capacity refreshes the STR estimate.</p>
        <div className="border-t border-base-300 pt-5">
          <div className="mb-4 space-y-2">
            <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Wallet className="size-4" aria-hidden="true" />Property value & long-term rent <span className="du-badge du-badge-sm du-badge-ghost">Recommended</span></h4>
            <p className="text-sm text-base-content/70">Used for rental and gross yield comparisons.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label htmlFor="str-property-value" className="text-sm font-medium">Estimated property value ({market.country === "US" ? "USD" : "$"})</label>
              <input id="str-property-value" type="number" inputMode="decimal" min="1" max="1000000000" step="any" className="du-input du-input-sm min-h-11 w-full" placeholder="e.g. 1200000" aria-invalid={Boolean(errors.propertyValue)} aria-describedby="str-value-help" {...register("propertyValue", { setValueAs: (value) => value == null || value === "" ? null : Number(value), onChange: () => edited.current.add("propertyValue") })} />
              {errors.propertyValue && <p role="alert" className="text-sm text-error">Enter an estimated value between $1 and $1 billion, or leave it blank.</p>}
              <p id="str-value-help" className="text-xs text-base-content/65">{valuation ? "Use the estimate below or enter your own." : "Enter an estimated value, or add it later."}</p>
              {valuation && <p className="rounded-lg bg-base-200 px-3 py-2 text-xs leading-relaxed">Property estimate: <strong>{valuation.display}</strong>{valuationBand ? ` · range ${formatCurrency(valuationBand.lowerPrice)}–${formatCurrency(valuationBand.upperPrice)}` : ""}{valuation.date ? ` · ${valuation.date}` : ""}{valuation.confidence ? ` · ${valuation.confidence} confidence` : ""}.</p>}
            </div>
            <div className="min-w-0 space-y-2">
              <label htmlFor="str-weekly-rent" className="text-sm font-medium">Long-term rent ({market.country === "US" ? "USD" : "$"} / {market.rentPeriod})</label>
              <Controller name="weeklyRent" control={control} render={({ field }) => <input id="str-weekly-rent" type="number" inputMode="decimal" min="1" step="any" className="du-input du-input-sm min-h-11 w-full" placeholder={market.country === "US" ? "e.g. 6000" : "e.g. 850"} aria-invalid={Boolean(errors.weeklyRent)} aria-describedby="str-rent-help" name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value == null ? "" : Number(rentForPeriod(field.value, market).toFixed(6))} onChange={(event) => { edited.current.add("weeklyRent"); field.onChange(event.target.value === "" ? null : rentFromPeriod(Number(event.target.value), market)); }} />} />
              {errors.weeklyRent && <p role="alert" className="text-sm text-error">Enter a {market.rentPeriod === "month" ? "monthly" : "weekly"} rent greater than zero, or leave it blank.</p>}
              <p id="str-rent-help" className="text-xs text-base-content/65">{rentSuggestion ? `${rentSuggestion.source}: ${formatCurrency(rentForPeriod(rentSuggestion.value, market), market.currency)} / ${market.rentPeriod}${rentSuggestion.date ? ` · ${rentSuggestion.date}` : ""}. Edit if needed.` : `Enter your expected ${market.rentPeriod === "month" ? "monthly" : "weekly"} rent.`}</p>
              {annualRent !== null && <p className="text-sm font-medium">{formatCurrency(annualRent, market.currency)} / year <span className="font-normal text-base-content/65">before costs</span></p>}
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
                        <Popover.Description className="leading-relaxed text-base-content/70">Based on {market.rentPeriod === "month" ? "12 months’" : "52 weeks’"} rent and the estimated property value, before vacancy, expenses and purchase costs. This is a comparison guide, not a guaranteed return.</Popover.Description>
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
    </AppraisalStepPanel>
    <AppraisalStepPanel value="amenities">
    <fieldset disabled={busy} className="du-card du-card-border min-w-0 bg-base-100">
      <div className="du-card-body gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="du-card-title text-base">What can guests enjoy?</h3><span className="du-badge du-badge-sm du-badge-ghost">{selected.length + extras.length} selected</span></div>
        <p className="text-sm text-base-content/70">Select amenities guests can use.{imported.length > 0 && " Imported features are marked below."}</p>
        {typeof values.car_spaces === "number" && values.car_spaces > 0 && !selected.includes("free_parking_on_premises") && <p className="rounded-lg bg-base-200 px-3 py-2 text-sm">{values.car_spaces} car space{values.car_spaces === 1 ? "" : "s"} recorded. Select On-site parking if guests can use {values.car_spaces === 1 ? "it" : "them"}.</p>}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Property amenities">{amenityButtons(primaryAmenities)}</div>
        {moreAmenities.length > 0 && <details className="rounded-xl border border-base-300 p-3"><summary className="cursor-pointer py-1 text-sm font-medium">More amenities</summary><div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{amenityButtons(moreAmenities)}</div></details>}
        {extras.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Additional amenities">{extras.map((item) => <li key={item} className="flex max-w-full items-center gap-1 rounded-xl bg-base-200 pl-3 text-sm"><span className="break-words">{item}</span><button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11 min-w-11 shrink-0" aria-label={`Remove ${item}`} onClick={() => setValue("additionalAmenities", extras.filter((value) => value !== item), { shouldDirty: true })}><X className="size-4" aria-hidden="true" /></button></li>)}</ul>}
        <div className="space-y-2 border-t border-base-300 pt-4">
          <label htmlFor="str-add-amenity" className="text-sm font-medium">Add another amenity</label>
          <div className="flex gap-2"><input ref={additionalInput} id="str-add-amenity" value={additional} onChange={(event) => { setAdditional(event.target.value); setAmenityError(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAmenity(); } }} maxLength={80} className="du-input du-input-sm min-h-11 min-w-0 flex-1" placeholder="e.g. Private tennis court" /><button type="button" disabled={!additional.trim()} className="du-btn du-btn-sm min-h-11" onClick={() => addAmenity()}><Plus className="size-4" aria-hidden="true" />Add</button></div>
          {amenityError && <p role="alert" className="text-sm text-error">{amenityError}</p>}
        </div>
        {otherFeatures.length > 0 && <details className="text-sm"><summary className="cursor-pointer py-2 font-medium">Other imported features ({otherFeatures.length})</summary><p className="mb-2 text-xs text-base-content/65">Add only the features relevant to a guest’s stay.</p><div className="flex flex-wrap gap-2">{otherFeatures.map((feature) => <button type="button" key={feature} disabled={extras.some((item) => item.toLowerCase() === feature.toLowerCase())} className="du-btn du-btn-sm min-h-11 h-auto max-w-full whitespace-normal py-2" onClick={() => addAmenity(feature)}><Plus className="size-3.5 shrink-0" aria-hidden="true" />{feature}</button>)}</div></details>}
        <p className="text-xs leading-relaxed text-base-content/65">Amenities help match comparable stays. They don’t automatically increase the revenue estimate.</p>
      </div>
    </fieldset>
    </AppraisalStepPanel>
    </AppraisalStepTabs>
    <div role="group" aria-label="Property step actions" className="flex flex-wrap items-center justify-end gap-3 border-t border-base-300 pt-5 [&>button]:w-full sm:[&>button]:w-auto">
      {continueAction}
    </div>
  </section>;
});
