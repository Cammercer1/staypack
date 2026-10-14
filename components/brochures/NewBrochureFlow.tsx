"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PropertyStartFlow } from "@/components/properties/PropertyStartFlow";
import { brochureLabels, type BrochureType } from "@/lib/brochures/workspace";
import { readPrivateResponse } from "@/components/str-appraisals/useRemoteOptions";
import type { Listing } from "@/lib/types";

export function NewBrochureFlow({ initialListing, initialType = "sales_brochure", storageKey }: { initialListing: Listing | null; initialType?: BrochureType; storageKey: string }) {
  const router = useRouter();
  const [type, setType] = useState<BrochureType>(initialType);
  const [busy, setBusy] = useState(false);
  const [archivedKey, setArchivedKey] = useState("");
  async function create(listing: Listing) {
    setBusy(true);
    const key = `${listing.id}:${type}`;
    try {
      const response = await fetch("/api/brochures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: listing.id, type, restore_archived: archivedKey === key }) });
      if (response.status === 409) { setArchivedKey(key); throw new Error("This brochure is archived. Restore it to continue with its saved design."); }
      const result = await readPrivateResponse(response);
      router.push(result.path); router.refresh();
    } finally { setBusy(false); }
  }
  return <div data-theme="staypack-workspace" className="space-y-6 text-base-content">
    <Link href="/brochures" className="inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft className="size-4" />Brochures</Link>
    <header><h1 className="font-display text-3xl">Create a brochure</h1><p className="mt-3 text-base-content/65">Choose your property, then prepare your brochure.</p></header>
    <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 text-sm font-medium">Brochure type</legend><div className="flex flex-wrap gap-3">{Object.entries(brochureLabels).map(([value, label]) => <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${type === value ? "border-primary bg-primary/5" : "border-base-300"}`}><input type="radio" name="brochure-type" value={value} checked={type === value} onChange={() => {
      setType(value as BrochureType); setArchivedKey("");
      const url = new URL(window.location.href); url.searchParams.set("type", value); window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }} className="du-radio du-radio-sm" />{label}</label>)}</div></fieldset>
    <PropertyStartFlow initialListing={initialListing} storageKey={storageKey} busy={busy} continueLabel={listing => archivedKey === `${listing.id}:${type}` ? "Restore brochure" : "Continue to brochure"} onContinue={create} />
  </div>;
}
