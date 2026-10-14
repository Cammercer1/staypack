"use client";
import { useEffect, useState } from "react";
import { PropertyDetailsForm } from "@/components/listings/PropertyDetailsForm";
import { CollateralImageEditor } from "@/components/listings/CollateralImageEditor";
import { ListingAgentsStrip } from "@/components/listings/ListingAgentsStrip";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import type { Listing } from "@/lib/types";

export function PropertySetup({ listing, onUpdated, onDirtyChange }: { listing: Listing; onUpdated: (listing: Listing) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [photosDirty, setPhotosDirty] = useState(false);
  const dirty = detailsDirty || photosDirty;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  return <div className="space-y-4">
    <UnsavedListingGuard dirty={dirty} />
    <ListingAgentsStrip listing={listing} onUpdated={onUpdated} />
    <details className="rounded-xl border border-base-300 bg-base-100 p-5"><summary className="cursor-pointer font-medium">Property details{detailsDirty ? " · Unsaved changes" : ""}</summary><div className="mt-5"><PropertyDetailsForm listing={listing} onSaved={onUpdated} onDirtyChange={setDetailsDirty} /></div></details>
    <details open className="rounded-xl border border-base-300 bg-base-100 p-5"><summary className="cursor-pointer font-medium">Property photos{photosDirty ? " · Unsaved changes" : ""}</summary><div className="mt-5"><CollateralImageEditor listing={listing} onUpdated={onUpdated} onDirtyChange={setPhotosDirty} /></div></details>
    {dirty && <p role="status" className="text-sm text-base-content/65">Save your changes before continuing.</p>}
  </div>;
}
