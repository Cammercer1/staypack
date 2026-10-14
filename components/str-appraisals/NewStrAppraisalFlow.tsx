"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Plus, Search } from "lucide-react";
import { NewListingFlow } from "@/components/listings/NewListingFlow";
import { ListingThumbnail } from "@/components/listings/ListingThumbnail";
import { getCollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";
import { strAppraisalPath } from "@/lib/str-appraisals/types";
import type { Listing } from "@/lib/types";
import { readPrivateResponse, useRemoteOptions } from "./useRemoteOptions";

type PropertyOption = Pick<Listing,"id" | "property_address" | "suburb" | "hero_image_url">;
export function NewStrAppraisalFlow({ initialListing, storageKey }: {
  initialListing: Listing | null;
  storageKey: string;
}) {
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [mode, setMode] = useState<"library" | "import">("library");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const creating = useRef(false);
  const options = useRemoteOptions<PropertyOption>(`/api/str/properties?q=${encodeURIComponent(search)}`, "properties", !listing && mode === "library");
  async function selectProperty(id: string) {
    setBusy(true); setError(null);
    try {
      const result = await readPrivateResponse(await fetch(`/api/listings/${id}`, { cache: "no-store" }));
      if (result.listing.status === "archived") throw new Error("Restore this property before creating an appraisal.");
      setListing(result.listing);
      requestId.current = null;
      window.history.replaceState(null, "", `/short-term-rentals/appraisals/new?listing_id=${encodeURIComponent(id)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to select property."); }
    finally { setBusy(false); }
  }
  async function createAppraisal() {
    if (!listing || creating.current) return;
    creating.current = true;
    setBusy(true); setError(null);
    try {
      requestId.current ??= crypto.randomUUID();
      const result = await readPrivateResponse(await fetch("/api/str/appraisals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: listing.id, request_id: requestId.current, recipient: { mode: "general", name: "", email: "", phone: "" } }) }));
      router.push(strAppraisalPath(result.report.id)); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create appraisal."); }
    finally { creating.current = false; setBusy(false); }
  }
  const photos = listing ? getCollateralPhotoRequirement(listing) : null;
  return <div className="space-y-6">
    <Link href="/short-term-rentals" className="inline-flex min-h-10 items-center gap-2 text-sm hover:text-primary"><ArrowLeft className="size-4" aria-hidden="true" />Short-Term Rentals</Link>
    <header><h1 className="font-display text-3xl">Create STR appraisal</h1><p className="mt-2 text-base-content/65">Choose a property to start. Add customer details at the final Review & share step.</p></header>
    <ol aria-label="Appraisal setup" className="flex flex-wrap items-center gap-3 border-y border-base-300 py-4 text-sm"><li className={listing ? "text-base-content/60" : "font-semibold"}>1. Property</li><li aria-hidden="true"><ArrowRight className="size-4" /></li><li className={listing ? "font-semibold" : "text-base-content/60"}>2. Appraisal</li><li aria-hidden="true"><ArrowRight className="size-4" /></li><li className="text-base-content/60">3. Customer & share</li></ol>
    {error && <div className="du-alert du-alert-error" role="alert">{error}</div>}
    {!listing ? <>
      <div className="flex flex-wrap gap-3"><button className="du-btn du-btn-sm min-h-11" aria-pressed={mode === "library"} onClick={() => setMode("library")}><Building2 className="size-4" aria-hidden="true" />Choose from listings</button><button className="du-btn du-btn-sm min-h-11" aria-pressed={mode === "import"} onClick={() => setMode("import")}><Plus className="size-4" aria-hidden="true" />Import or add property</button></div>
      {mode === "import" ? <NewListingFlow includeAgents={false} storageKey={storageKey} onSaved={selectProperty} /> : <section className="space-y-4" aria-label="Property library">
        <label htmlFor="str-property-search" className="block text-sm font-medium">Search property address</label>
        <div className="du-input du-input-sm min-h-11 w-full"><Search className="size-4" aria-hidden="true" /><input id="str-property-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your shared property library" /></div>
        {options.error && <p role="alert" className="text-error">{options.error}</p>}
        {options.loading ? <p role="status">Loading properties…</p> : options.data.length === 0 ? <div className="rounded-xl border border-dashed border-base-300 p-6"><p>No properties found. Import an address or enter its details manually.</p><button className="du-btn du-btn-sm mt-4 min-h-11" onClick={() => setMode("import")}>Add a property</button></div> : <ul className="divide-y divide-base-300">{options.data.map((property) => <li key={property.id}><button disabled={busy} onClick={() => selectProperty(property.id)} className="flex min-h-24 w-full items-center gap-4 rounded-lg py-4 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"><ListingThumbnail src={property.hero_image_url} address={property.property_address || "Property"} className="size-16 shrink-0" /><span className="min-w-0 flex-1"><span className="block font-medium">{property.property_address || "Untitled property"}</span><span className="text-sm text-base-content/65">{property.suburb}</span></span><ArrowRight className="mr-2 size-4 shrink-0" aria-hidden="true" /></button></li>)}</ul>}
      </section>}
    </> : <>
      <section className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-xl border border-base-300 bg-base-100 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]"><ListingThumbnail eager src={listing.hero_image_url} address={listing.property_address || "Property"} className="size-16 sm:size-20" /><div className="min-w-0 flex-1"><h2 className="font-display text-xl">{listing.property_address || "Untitled property"}</h2><p className="mt-1 text-sm text-base-content/65">Shared with your listings, appraisals and brochures.</p></div><Link href="/short-term-rentals/appraisals/new" aria-disabled={busy} tabIndex={busy ? -1 : undefined} className="du-btn du-btn-sm du-btn-ghost col-span-2 min-h-11 justify-self-start sm:col-span-1 sm:justify-self-end" onClick={(event) => { if (busy) { event.preventDefault(); return; } requestId.current = null; setListing(null); setMode("library"); }}>Change property</Link></section>
      {photos && !photos.met ? <div className="du-alert du-alert-warning"><div><p>{photos.message}</p><Link href={`/listings/${listing.id}`} className="du-btn du-btn-sm mt-3 min-h-11">Open property photos</Link><button className="du-btn du-btn-sm du-btn-ghost ml-2 mt-3 min-h-11" disabled={busy} onClick={() => selectProperty(listing.id)}>Refresh photos</button></div></div> : <section className="max-w-3xl rounded-xl border border-base-300 bg-base-100 p-5 sm:p-7"><h2 className="font-display text-xl">Start with the property</h2><p className="mt-2 text-sm text-base-content/65">Review its details, estimate and report design. You can add a customer before sharing.</p><button type="button" className="du-btn du-btn-sm du-btn-primary mt-5 min-h-11" disabled={busy} onClick={() => void createAppraisal()}>{busy ? "Creating appraisal…" : "Create appraisal"}<ArrowRight className="size-4" aria-hidden="true" /></button></section>}
    </>}
  </div>;
}
