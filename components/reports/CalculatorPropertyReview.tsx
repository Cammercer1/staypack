"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ImageIcon, Loader2, MapPin, Pencil, RefreshCw, Search } from "lucide-react";
import { AddressAutocomplete } from "@/components/listings/AddressAutocomplete";
import { marketForCountry } from "@/lib/property-market";
import { suggestedWeeklyRent } from "@/lib/str/propertyInputs";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import type { PropertyCandidate } from "@/lib/listings/propertyLookupTypes";
import type { Listing } from "@/lib/types";

const addressSchema = z.object({
  property_address: z.string().trim().min(3, "Enter the street address, including any unit number").max(250),
  suburb: z.string().trim().min(1, "Enter the suburb or city").max(120),
  state: z.string().trim().min(2, "Enter the state").max(20),
  postcode: z.string().trim().min(4, "Enter the postcode or ZIP code").max(10),
});
type ManualAddress = z.infer<typeof addressSchema>;
export type CalculatorPropertySelection = { candidate?: PropertyCandidate; address?: ManualAddress };

function addressValues(profile: Listing): ManualAddress {
  return { property_address: profile.property_address ?? "", suburb: profile.suburb ?? "", state: profile.state ?? "", postcode: profile.postcode ?? "" };
}

/** Review provider evidence without silently replacing the visitor's property inputs. */
export function CalculatorPropertyReview({ profile, loading, error, addressUpdated, onLookup, onEditingChange }: {
  profile: Listing;
  loading: boolean;
  error: string | null;
  addressUpdated: boolean;
  onLookup: (selection: CalculatorPropertySelection) => Promise<Listing | null>;
  onEditingChange: (editing: boolean) => void;
}) {
  const market = marketForCountry(profile.country);
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<PropertyCandidate[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const { register, reset, handleSubmit, formState: { errors } } = useForm<ManualAddress>({ resolver: zodResolver(addressSchema), defaultValues: addressValues(profile) });
  const address = [profile.property_address?.trim(), profile.suburb, profile.state, profile.postcode].filter(Boolean).join(", ");
  const photos = [...new Set([profile.hero_image_url, ...(profile.selected_image_urls ?? [])].filter((url): url is string => Boolean(url)))];
  const rent = suggestedWeeklyRent(profile);
  const provider = market.country === "US" ? "Zillow" : "Domain";
  const busy = loading || searching || resolving;

  function changeEditing(next: boolean) {
    setEditing(next); onEditingChange(next);
    setManual(false); setCandidates([]); setSearchMessage(null);
    if (next) { setQuery(address); reset(addressValues(profile)); }
  }
  async function search(addressQuery = query) {
    if (busy || addressQuery.trim().length < 5) return;
    setSearching(true); setCandidates([]); setSearchMessage(null);
    try {
      const result = await reportRequest<{ candidates?: PropertyCandidate[]; message?: string }>("/api/listings/lookup", jsonRequest({ action: "search", country: market.country, query: addressQuery }));
      setCandidates(result.candidates ?? []);
      setSearchMessage(result.message ?? (!result.candidates?.length ? "No matching property found. Check the address or enter it manually." : null));
    } catch (cause) {
      setSearchMessage(cause instanceof Error ? cause.message : "Property lookup is unavailable. You can enter the address manually.");
    } finally { setSearching(false); }
  }
  async function apply(selection: CalculatorPropertySelection) {
    const fetched = await onLookup(selection);
    if (fetched) changeEditing(false);
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h3 className="du-card-title text-base">The property</h3>
        <p className="text-sm text-base-content/75">{address}</p>
      </div>
      {!editing && <button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" disabled={loading} onClick={() => changeEditing(true)}><Pencil className="size-4" aria-hidden="true" />Check or correct address</button>}
    </div>
    {addressUpdated && <p role="status" className="text-sm font-medium">Address updated. Review the refreshed photos and rental details below, then confirm the room counts.</p>}
    <div role="status" aria-live="polite" className={error ? "rounded-xl border border-warning/25 bg-warning/5 p-4" : "rounded-xl bg-base-200/60 p-4"}>
      <p className="flex items-center gap-2 text-sm font-medium">
        {loading ? <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" /> : error ? <MapPin className="size-4 shrink-0" aria-hidden="true" /> : <Check className="size-4 shrink-0" aria-hidden="true" />}
        {loading ? `Checking ${provider} for photos and rental details…` : error ? "Check the property match" : "Property details ready to review"}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-base-content/70">{loading ? "You can review the room counts while we look up this address." : error ? `${error} Check the address, try again, or enter the details below yourself.` : "Check that the photos and details belong to this exact property, including the unit number."}</p>
      {error && !editing && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="du-btn du-btn-sm du-btn-outline min-h-11" disabled={loading} onClick={() => changeEditing(true)}><Search className="size-4" aria-hidden="true" />Find the right property</button>
        <button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" disabled={loading} onClick={() => void onLookup({})}><RefreshCw className="size-4" aria-hidden="true" />Try again</button>
      </div>}
    </div>
    {editing && <div className="space-y-4 rounded-xl border border-base-300 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{manual ? "Enter the property address" : "Find the right property"}</h4><button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" disabled={busy} onClick={() => changeEditing(false)}>Cancel</button></div>
      {manual ? <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {([['property_address', 'Street address', 'sm:col-span-2'], ['suburb', market.country === 'US' ? 'City' : 'Suburb', ''], ['state', 'State', ''], ['postcode', market.country === 'US' ? 'ZIP code' : 'Postcode', '']] as const).map(([field, label, classes]) => <div key={field} className={classes}>
            <label htmlFor={`review-${field}`} className="mb-1.5 block text-sm font-medium">{label}</label>
            <input id={`review-${field}`} className="du-input min-h-11 w-full" disabled={busy} aria-invalid={Boolean(errors[field])} {...register(field)} />
            {errors[field] && <p role="alert" className="mt-1 text-sm text-error">{errors[field]?.message}</p>}
          </div>)}
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="du-btn du-btn-sm du-btn-primary min-h-11" onClick={() => void handleSubmit((address) => apply({ address }))()}>Use this address</button><button type="button" disabled={busy} className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => setManual(false)}>Back to search</button></div>
      </div> : <>
        <label htmlFor="calculator-review-address" className="sr-only">Search property address</label>
        <div className="flex flex-col gap-2 sm:flex-row"><AddressAutocomplete id="calculator-review-address" country={market.country} value={query} disabled={loading || searching} onChange={(value) => { setQuery(value); setCandidates([]); setSearchMessage(null); }} onResolvingChange={setResolving} /><button type="button" className="du-btn du-btn-primary min-h-12" disabled={busy || query.trim().length < 5} onClick={() => void search()}>{searching ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}Find property</button></div>
        <p className="text-xs leading-relaxed text-base-content/65">Include the unit number and suburb. Choose the exact property before importing its details.</p>
        {searchMessage && <p role="status" className="text-sm text-base-content/75">{searchMessage}</p>}
        {candidates.length > 0 && <ul aria-label="Matching properties" className="space-y-2">{candidates.map((candidate, index) => <li key={`${candidate.slug ?? candidate.placeId ?? candidate.address}-${index}`}><button type="button" disabled={busy} className="du-btn du-btn-outline h-auto min-h-14 w-full justify-start whitespace-normal px-3 py-3 text-left" onClick={() => void apply({ candidate })}><MapPin className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0"><span className="block">{candidate.address}</span><span className="mt-1 block text-xs font-normal text-base-content/65">{candidate.source === "domain" ? "Property profile" : "Check property details"}</span></span></button></li>)}</ul>}
        <button type="button" disabled={busy} className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => setManual(true)}>Enter address manually</button>
      </>}
    </div>}
    {!loading && <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><p className="flex items-center gap-2"><ImageIcon className="size-4" aria-hidden="true" />{photos.length ? `${photos.length} property photo${photos.length === 1 ? "" : "s"} available` : "No property photos found"}</p><p className={rent ? "text-base-content/70" : "text-base-content/60"}>{rent ? "Rental details imported below" : "No rental estimate found — enter your own below"}</p></div>
      {photos.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Imported property photos">{photos.slice(0, 4).map((url, index) =>
        // Provider images can use many approved hosts; these are previews of the saved image URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt={`Property photo ${index + 1}`} className="aspect-[4/3] w-full rounded-lg bg-base-200 object-cover" loading="lazy" />
      )}</div>}
    </div>}
  </div>;
}
