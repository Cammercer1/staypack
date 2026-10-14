"use client";
import Link from "next/link";
import { useState } from "react";
import { PropertySetup } from "./PropertySetup";
import type { Listing } from "@/lib/types";
export function PropertyEditor({ initialListing, returnPath, returnLabel }: { initialListing: Listing; returnPath: string; returnLabel: string }) {
  const [listing, setListing] = useState(initialListing);
  const [dirty, setDirty] = useState(false);
  return <div data-theme="staypack-workspace" className="space-y-6 text-base-content"><Link href={returnPath} className="inline-flex min-h-11 items-center text-sm">← Back to {returnLabel}</Link><header><h1 className="font-display text-3xl">Property details & photos</h1><p className="mt-3 text-base-content/65">{listing.property_address}</p></header><PropertySetup listing={listing} onUpdated={setListing} onDirtyChange={setDirty} /><Link aria-disabled={dirty} tabIndex={dirty ? -1 : undefined} onClick={event => { if (dirty) event.preventDefault(); }} href={returnPath} className={`du-btn du-btn-sm du-btn-primary min-h-12 ${dirty ? "du-btn-disabled" : ""}`}>Continue to {returnLabel}</Link></div>;
}
