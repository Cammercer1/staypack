"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PropertyStartFlow } from "@/components/properties/PropertyStartFlow";
import { readPrivateResponse } from "@/components/str-appraisals/useRemoteOptions";
import type { Listing } from "@/lib/types";
export function NewSocialFlow({ initialListing, storageKey }: { initialListing: Listing | null; storageKey: string }) {
  const router = useRouter();
  const [archivedId, setArchivedId] = useState("");
  async function create(listing: Listing) {
    const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: listing.id, restore_archived: archivedId === listing.id }) });
    if (response.status === 409) { setArchivedId(listing.id); throw new Error("This social design is archived. Restore it to continue with its saved edits."); }
    const result = await readPrivateResponse(response);
    router.push(result.path); router.refresh();
  }
  return <div data-theme="staypack-workspace" className="space-y-6 text-base-content">
    <Link href="/social" className="inline-flex min-h-11 items-center text-sm">← Social media</Link>
    <header><h1 className="font-display text-3xl">Create a social post</h1><p className="mt-3 text-base-content/65">Choose your property, then prepare your square, wide and story images.</p></header>
    <PropertyStartFlow initialListing={initialListing} storageKey={storageKey} minimumPhotos={1} continueLabel={listing => archivedId === listing.id ? "Restore social design" : "Continue to social editor"} onContinue={create} />
  </div>;
}
