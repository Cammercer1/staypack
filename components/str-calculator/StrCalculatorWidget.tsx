"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Bath, BedDouble, Check, LoaderCircle, Mail, MapPin, Minus, Phone, Plus, UserRound } from "lucide-react";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import { AddressAutocomplete } from "@/components/listings/AddressAutocomplete";
import { cn } from "@/lib/utils";
import { calculatorBrandStyle, type CalculatorBrand } from "@/lib/str-calculator/brand";
import { calculatorAssumptions, calculatorConsent, calculatorFieldsSchema, calculatorMoney, type CalculatorEstimate, type CalculatorFields } from "@/lib/str-calculator/schema";

type Props = { brand: CalculatorBrand; country: "AU" | "US"; token?: string; preview?: boolean; askPhone?: boolean };
const steps = ["Property", "Your details", "Estimate"];
const contactInputClass = "group du-input du-input-sm min-h-12 w-full gap-3 rounded-xl bg-base-content/[0.025] px-4 shadow-none transition-colors focus-within:bg-base-100 focus-within:outline-none focus-within:ring-4 motion-reduce:transition-none";
const propertyCounters = [
  { name: "bedrooms", label: "Bedrooms", Icon: BedDouble, min: 0, max: 10, increment: 1 },
  { name: "bathrooms", label: "Bathrooms", Icon: Bath, min: 0.5, max: 20, increment: 0.5 },
] as const;

export function StrCalculatorWidget({ brand, country, token, preview = false, askPhone = false }: Props) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [estimate, setEstimate] = useState<CalculatorEstimate | null>(null);
  const activeStep = estimate ? 2 : step;
  const [error, setError] = useState("");
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [addressResolving, setAddressResolving] = useState(false);
  const requestRef = useRef<{ id: string; values: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useForm<CalculatorFields>({ resolver: zodResolver(calculatorFieldsSchema), defaultValues: { address: "", bedrooms: 2, bathrooms: 1, full_name: "", email: "", phone: "", consent: false, website: "" } });
  const { register, handleSubmit, trigger, getValues, formState: { errors, isSubmitting } } = form;

  useEffect(() => { if (step > 0 || estimate) heading.current?.focus({ preventScroll: true }); }, [step, estimate]);

  async function next() {
    if (addressResolving) return;
    const valid = await trigger(["address", "bedrooms", "bathrooms"], { shouldFocus: true });
    if (valid) { setError(""); setStep(1); }
  }

  async function submit(values: CalculatorFields) {
    setError("");
    setLeadCaptured(false);
    if (preview) {
      setEstimate({ annualRevenue: 62400, monthlyRevenue: 5200, nightlyRate: 260, occupancyRate: 65.8,
        currency: country === "US" ? "USD" : "AUD", address: values.address, bedrooms: values.bedrooms, bathrooms: values.bathrooms,
        ...calculatorAssumptions(values.bedrooms) });
      return;
    }
    const encoded = JSON.stringify(values);
    if (!requestRef.current || requestRef.current.values !== encoded) requestRef.current = { id: crypto.randomUUID(), values: encoded };
    try {
      const response = await fetch(`/api/str-calculator/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, phone: askPhone ? values.phone : undefined, requestId: requestRef.current.id }), signal: AbortSignal.timeout(45000),
      });
      const result = await response.json();
      if (!response.ok) { setLeadCaptured(result.leadCaptured === true); throw new Error(result.error || "We couldn’t prepare your estimate. Please try again."); }
      setEstimate(result.estimate);
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== "TimeoutError" && cause.name !== "TypeError" ? cause.message : "We couldn’t reach the calculator. Please try again; your request won’t be duplicated.");
    }
  }

  return <section aria-label={`${brand.name} STR calculator`} data-theme="agency-proposal" style={calculatorBrandStyle(brand)} className={preview ? "min-w-0 bg-base-100 font-[family-name:var(--proposal-body)] text-base-content" : "min-h-dvh min-w-0 bg-base-100 font-[family-name:var(--proposal-body)] text-base-content"}>
    <BrandFontLoader fonts={brand} />
    <div className="mx-auto max-w-xl px-5 py-7 sm:px-8 sm:py-8">
      {preview && <div className="mb-6 flex justify-end"><span className="du-badge du-badge-sm du-badge-outline">Preview</span></div>}

      <ol aria-label="Calculator progress" className="mb-8 grid grid-cols-3 gap-3">
        {steps.map((label, index) => <li key={label} aria-current={activeStep === index ? "step" : undefined} className="text-xs">
          <div className={index <= activeStep ? "mb-2 h-1 rounded-full bg-primary" : "mb-2 h-1 rounded-full bg-base-300"} />
          <span className="flex items-center gap-1.5">{index < activeStep ? <Check className="size-3.5" aria-hidden="true" /> : <span>{index + 1}.</span>}{label}</span>
        </li>)}
      </ol>
      {!estimate ? <>
        <h2 ref={heading} tabIndex={-1} className="font-[family-name:var(--proposal-heading)] text-3xl leading-tight outline-none">
          {step === 0 ? "What could your property earn?" : "Your details."}
        </h2>
        <p className="mt-3 text-sm leading-6 text-base-content/75">
          {step === 0 ? "Explore your estimated gross STR revenue in three simple steps." : "Enter your details to view your estimated gross STR revenue."}
        </p>
        {step > 0 && <div className="mt-5 flex gap-2 border-y border-base-300 py-3 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p className="min-w-0 break-words">{getValues("address")}<span className="mt-1 block text-xs text-base-content/70">{getValues("bedrooms") === 0 ? "Studio" : `${getValues("bedrooms")} bedroom${getValues("bedrooms") === 1 ? "" : "s"}`} · {getValues("bathrooms")} bathroom{getValues("bathrooms") === 1 ? "" : "s"}</span></p>
        </div>}
        <form noValidate onSubmit={event => { if (step === 0) { event.preventDefault(); void next(); } else { void handleSubmit(submit)(event); } }} className="mt-6">
          <fieldset disabled={isSubmitting} className="space-y-5">
            {step === 0 && <Controller name="address" control={form.control} render={({ field, fieldState }) => <AddressAutocomplete
              id={`${id}-address`} appearance="calculator" country={country} value={field.value} inputRef={field.ref}
              onChange={value => { field.onChange(value); form.clearErrors("address"); }} onBlur={field.onBlur}
              onResolvingChange={setAddressResolving} disabled={isSubmitting} error={fieldState.error?.message}
              endpoint={preview ? process.env.NODE_ENV === "development" ? "/api/str-calculator/preview/address-suggestions" : "/api/listings/address-suggestions" : `/api/str-calculator/${token}/address-suggestions`}
            />} />}
            {step === 0 && <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">
              {propertyCounters.map(({ name, label, Icon, min, max, increment }) => <Controller key={name} name={name} control={form.control} render={({ field }) => <div className="flex min-w-0 items-center justify-between gap-2">
                <label htmlFor={`${id}-${name}`} className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4.5 shrink-0 text-base-content/60" aria-hidden="true" />{label}</label>
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-base-300/70 bg-base-content/[0.035] p-1">
                  <button type="button" aria-label={`Decrease ${name}`} disabled={field.value <= min} onClick={() => field.onChange(Math.max(min, field.value - increment))} className="du-btn du-btn-sm du-btn-circle size-9 min-h-9 border-0 bg-base-100 text-base-content shadow-sm hover:bg-primary hover:text-primary-foreground focus-visible:outline-primary motion-reduce:transition-none disabled:bg-transparent disabled:opacity-30 disabled:shadow-none"><Minus className="size-4" aria-hidden="true" /></button>
                  <output id={`${id}-${name}`} aria-live="polite" className="w-9 text-center text-sm font-semibold tabular-nums">{name === "bedrooms" && field.value === 0 ? "Studio" : field.value}</output>
                  <button type="button" aria-label={`Increase ${name}`} disabled={field.value >= max} onClick={() => field.onChange(Math.min(max, field.value + increment))} className="du-btn du-btn-sm du-btn-circle size-9 min-h-9 border-0 bg-base-100 text-base-content shadow-sm hover:bg-primary hover:text-primary-foreground focus-visible:outline-primary motion-reduce:transition-none disabled:bg-transparent disabled:opacity-30 disabled:shadow-none"><Plus className="size-4" aria-hidden="true" /></button>
                </div>
              </div>} />)}
            </div>}
            {step === 1 && <>
              <div><label htmlFor={`${id}-name`} className={cn(contactInputClass, errors.full_name ? "du-input-error border-error focus-within:ring-error/10" : "border-base-300/80 hover:border-base-content/25 focus-within:border-primary focus-within:ring-primary/10")}>
                <UserRound className="size-4.5 shrink-0 text-base-content/60 group-focus-within:text-base-content" aria-hidden="true" />
                <input id={`${id}-name`} aria-label="Full name" type="text" autoComplete="name" placeholder="Full name" {...register("full_name")} aria-invalid={Boolean(errors.full_name)} aria-describedby={errors.full_name ? `${id}-name-error` : undefined} className="min-w-0 grow text-base" maxLength={200} />
                </label>
                {errors.full_name && <p id={`${id}-name-error`} role="alert" className="mt-2 text-xs text-error">{errors.full_name.message}</p>}
              </div>
              <div><label htmlFor={`${id}-email`} className={cn(contactInputClass, errors.email ? "du-input-error border-error focus-within:ring-error/10" : "border-base-300/80 hover:border-base-content/25 focus-within:border-primary focus-within:ring-primary/10")}>
                <Mail className="size-4.5 shrink-0 text-base-content/60 group-focus-within:text-base-content" aria-hidden="true" />
                <input id={`${id}-email`} aria-label="Email address" type="email" autoComplete="email" placeholder="Email address" {...register("email")} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${id}-email-error` : undefined} className="min-w-0 grow text-base" maxLength={254} />
                </label>
                {errors.email && <p id={`${id}-email-error`} role="alert" className="mt-2 text-xs text-error">{errors.email.message}</p>}
              </div>
              {askPhone && <div><label htmlFor={`${id}-phone`} className={cn(contactInputClass, errors.phone ? "du-input-error border-error focus-within:ring-error/10" : "border-base-300/80 hover:border-base-content/25 focus-within:border-primary focus-within:ring-primary/10")}>
                <Phone className="size-4.5 shrink-0 text-base-content/60 group-focus-within:text-base-content" aria-hidden="true" />
                <input id={`${id}-phone`} aria-label="Phone number (optional)" type="tel" autoComplete="tel" placeholder="Phone number (optional)" {...register("phone")} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${id}-phone-error` : undefined} className="min-w-0 grow text-base" maxLength={32} />
                </label>
                {errors.phone && <p id={`${id}-phone-error`} role="alert" className="mt-2 text-xs text-error">{errors.phone.message}</p>}
              </div>}
              <label className="flex items-start gap-3 text-xs leading-5"><input type="checkbox" {...register("consent")} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? `${id}-consent-error` : undefined} className="mt-1 size-4 shrink-0 accent-current" /><span>{calculatorConsent(brand.name, askPhone)}</span></label>
              {errors.consent && <p id={`${id}-consent-error`} role="alert" className="text-xs text-error">{errors.consent.message}</p>}
              <div hidden aria-hidden="true"><label htmlFor={`${id}-website`}>Leave this field empty</label><input id={`${id}-website`} aria-label="Leave this field empty" tabIndex={-1} autoComplete="off" {...register("website")} /></div>
            </>}
            {error && <div role="alert" className="du-alert du-alert-error text-sm"><span>{leadCaptured && <strong className="mb-1 block">Enquiry saved</strong>}{error}</span></div>}
            <div className="flex items-center gap-3 pt-1">
              {step > 0 && <button type="button" onClick={() => { setStep(0); setError(""); }} className="du-btn du-btn-ghost min-h-12 px-3"><ArrowLeft className="size-4" aria-hidden="true" />Back</button>}
              <button type="submit" disabled={addressResolving} className="du-btn du-btn-primary min-h-12 flex-1">{isSubmitting ? <><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />Preparing estimate…</> : <>{step === 0 ? "Continue" : preview ? "View sample estimate" : "View my estimate"}<ArrowRight className="size-4" aria-hidden="true" /></>}</button>
            </div>
            {!preview && <p aria-live="polite" className="text-center text-xs leading-5 text-base-content/70">{isSubmitting ? "This may take up to 30 seconds." : "An estimate, with no obligation."}</p>}
          </fieldset>
        </form>
      </> : <div aria-live="polite">
        <h2 ref={heading} tabIndex={-1} className="font-[family-name:var(--proposal-heading)] text-3xl leading-tight outline-none">Your property’s STR potential.</h2>
        <p className="mt-3 flex items-start gap-2 text-sm leading-6"><MapPin className="mt-1 size-4 shrink-0" aria-hidden="true" /><span className="break-words">{estimate.address}</span></p>
        <div className="my-6 border-y border-base-300 py-6">
          <p className="text-sm">Estimated gross STR revenue</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{calculatorMoney(estimate.annualRevenue, estimate.currency)}<span className="ml-2 text-sm font-normal tracking-normal">{estimate.currency} / year</span></p>
          <p className="mt-2 text-sm text-base-content/75">Approximately {calculatorMoney(estimate.monthlyRevenue, estimate.currency)} per month, before expenses.</p>
        </div>
        <p className="text-xs leading-5 text-base-content/75">Based on an entire home with {estimate.bedrooms === 0 ? "a studio layout" : `${estimate.bedrooms} bedroom${estimate.bedrooms === 1 ? "" : "s"}`}, {estimate.bathrooms} bathroom{estimate.bathrooms === 1 ? "" : "s"}, up to {estimate.guests} guests and comparable properties within approximately 2 km. Actual suitability and local rules need to be checked.</p>
      </div>}
      {!preview && !estimate && <footer className="mt-7 border-t border-base-300 pt-4"><p className="text-xs leading-5 text-base-content/70">Estimate only. Actual performance varies. Revenue is before operating expenses and is not guaranteed.</p></footer>}
    </div>
  </section>;
}
