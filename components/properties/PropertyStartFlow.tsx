"use client";
import { useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { NewListingFlow } from "@/components/listings/NewListingFlow";
import { ListingThumbnail } from "@/components/listings/ListingThumbnail";
import { PropertySetup } from "./PropertySetup";
import { PropertyContext } from "./PropertyContext";
import { readPrivateResponse, useRemoteOptions } from "@/components/str-appraisals/useRemoteOptions";
import { getMasterPhotoCount } from "@/lib/listings/collateralPhotoRequirements";
import type { Listing } from "@/lib/types";

type PropertyOption = Pick<Listing, "id" | "property_address" | "suburb" | "hero_image_url">;
export function PropertyStartFlow({ initialListing, storageKey, minimumPhotos = 5, continueLabel, busy = false, onContinue }: {
  initialListing: Listing | null;
  storageKey: string;
  minimumPhotos?: number;
  continueLabel: string | ((listing: Listing) => string);
  busy?: boolean;
  onContinue: (listing: Listing) => Promise<void>;
}) {
  const query = useSearchParams();
  const searchId = useId();
  const [listing, setListing] = useState(initialListing);
  const [mode, setMode] = useState(query.get("mode") === "import" ? "import" : "existing");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const options = useRemoteOptions<PropertyOption>(`/api/properties?q=${encodeURIComponent(search)}`, "properties", !listing && mode === "existing");
  const disabled = busy || loading;
  function updateLocation(id: string | null, nextMode = mode) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("listing_id", id); else url.searchParams.delete("listing_id");
    if (nextMode === "import") url.searchParams.set("mode", "import"); else url.searchParams.delete("mode");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  function changeMode(next: string) {
    setMode(next); setError(""); updateLocation(null, next);
  }
  async function select(id: string) {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError("");
    try {
      const result = await readPrivateResponse(await fetch(`/api/listings/${id}`, { cache: "no-store" }));
      if (result.listing.status === "archived") throw new Error("Choose an active property.");
      setListing(result.listing); setEditing(false); updateLocation(result.listing.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load this property. Try again."); }
    finally { pending.current = false; setLoading(false); }
  }
  async function proceed() {
    if (!listing || disabled || dirty || pending.current) return;
    pending.current = true; setLoading(true); setError("");
    try { await onContinue(listing); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to continue. Try again."); }
    finally { pending.current = false; setLoading(false); }
  }
  const photoCount = listing ? getMasterPhotoCount(listing) : 0;
  return <div className="space-y-5">
    {error && <p role="alert" className="du-alert du-alert-error">{error}</p>}
    {!listing ? <>
      <h2 className="font-display text-2xl">Which property?</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} aria-pressed={mode === "existing"} onClick={() => changeMode("existing")} className={mode === "existing" ? "du-btn du-btn-sm min-h-11 du-btn-primary" : "du-btn du-btn-sm min-h-11"}>Existing property</button>
        <button type="button" disabled={disabled} aria-pressed={mode === "import"} onClick={() => changeMode("import")} className={mode === "import" ? "du-btn du-btn-sm min-h-11 du-btn-primary" : "du-btn du-btn-sm min-h-11"}>Import or add property</button>
      </div>
      {mode === "import" ? <NewListingFlow storageKey={storageKey} includeAgents={false} onSaved={select} /> : <section aria-label="Choose a property" className="space-y-4">
        <label htmlFor={searchId} className="block text-sm font-medium">Search property address</label>
        <div className="du-input du-input-sm min-h-12 w-full"><Search className="size-4" aria-hidden="true" /><input aria-label="Search property address" id={searchId} type="search" value={search} maxLength={160} onChange={event => setSearch(event.target.value)} placeholder="Search your properties" /></div>
        {options.error ? <p role="alert" className="text-error">{options.error}</p> : options.loading ? <p role="status">Loading properties…</p> : options.data.length ? <ul className="divide-y divide-base-300 border-y border-base-300">
          {options.data.map(property => <li key={property.id}><button type="button" disabled={disabled} onClick={() => void select(property.id)} className="flex min-h-24 w-full items-center gap-4 rounded-lg py-4 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary">
            <ListingThumbnail src={property.hero_image_url} address={property.property_address || "Property"} className="size-16 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block font-medium">{property.property_address || "Untitled property"}</span><span className="text-sm text-base-content/65">{property.suburb}</span></span>
            <ArrowRight className="mr-2 size-4 shrink-0" aria-hidden="true" />
          </button></li>)}
        </ul> : <div className="space-y-3 rounded-xl border border-dashed border-base-300 p-6"><p>No properties found.</p><button type="button" className="du-btn du-btn-sm min-h-11" onClick={() => changeMode("import")}>Import or add property</button></div>}
      </section>}
    </> : <>
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <PropertyContext listing={listing} onEdit={() => setEditing(true)} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-base-content/65">{photoCount} photo{photoCount === 1 ? "" : "s"} · {listing.bedrooms ?? "—"} bed · {listing.bathrooms ?? "—"} bath</p>
          <button type="button" disabled={dirty} className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => { setListing(null); setEditing(false); setError(""); updateLocation(null); }}>Change property</button>
        </div>
        {photoCount < minimumPhotos && <p role="status" className="du-alert">Add and save at least {minimumPhotos} property photo{minimumPhotos === 1 ? "" : "s"} below before preparing a new document.</p>}
        {(editing || photoCount < minimumPhotos) && <PropertySetup key={listing.id} listing={listing} onUpdated={setListing} onDirtyChange={setDirty} />}
      </fieldset>
      <button type="button" disabled={disabled || dirty} className="du-btn du-btn-sm du-btn-primary min-h-12" onClick={() => void proceed()}>{disabled ? "Opening…" : typeof continueLabel === "function" ? continueLabel(listing) : continueLabel}<ArrowRight className="size-4" aria-hidden="true" /></button>
    </>}
  </div>;
}
