"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PropertyStartFlow } from "@/components/properties/PropertyStartFlow";
import { appraisalKindLabels, appraisalPath, type WorkspaceAppraisalKind } from "@/lib/appraisals/workspaceTypes";
import { strAppraisalPath } from "@/lib/str-appraisals/types";
import { readPrivateResponse } from "./useRemoteOptions";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { generalRecipient, recipientSchema, type RecipientValues } from "@/lib/str-appraisals/validation";
import type { Listing } from "@/lib/types";

export function NewStrAppraisalFlow({ initialListing, initialRecipient = generalRecipient, storageKey, kind }: {
  initialRecipient?: RecipientValues; kind?: WorkspaceAppraisalKind; initialListing: Listing | null; storageKey: string;
}) {
  const router = useRouter();
  const product = kind ?? "str";
  const [recipient, setRecipient] = useState(initialRecipient);
  const [clientErrors, setClientErrors] = useState<Partial<Record<"name" | "email" | "phone", string>>>({});
  const [creating, setCreating] = useState(false);
  const request = useRef<{ listingId: string; id: string } | null>(null);
  async function create(listing: Listing) {
    const parsed = recipientSchema.safeParse(recipient);
    if (!parsed.success) {
      setClientErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      throw new Error("Check the contact details before creating the appraisal.");
    }
    setClientErrors({}); setCreating(true);
    try {
    const requestKey = `${storageKey}:appraisal-request:${product}:${listing.id}`;
    if (request.current?.listingId !== listing.id) {
      let id: string | null = null;
      try { id = sessionStorage.getItem(requestKey); } catch { /* Storage can be unavailable. */ }
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) id = crypto.randomUUID();
      request.current = { listingId: listing.id, id };
      try { sessionStorage.setItem(requestKey, id); } catch { /* In-memory retry still works. */ }
    }
    const result = await readPrivateResponse(await fetch(kind ? "/api/appraisals" : "/api/str/appraisals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(kind ? { kind: product } : {}), listing_id: listing.id, request_id: request.current.id, recipient: parsed.data }),
    }));
    try { sessionStorage.removeItem(requestKey); } catch { /* No stored draft to clear. */ }
    router.push(kind ? appraisalPath(result.report.id, product) : strAppraisalPath(result.report.id)); router.refresh();
    } finally { setCreating(false); }
  }
  const back = product === "str" ? "/short-term-rentals" : `/appraisals/${product === "lease" ? "rental" : "sales"}`;
  return <div data-theme="staypack-workspace" className="space-y-6 text-base-content">
    <Link href={back} className="inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft className="size-4" aria-hidden="true" />{appraisalKindLabels[product]} appraisals</Link>
    <header><h1 className="font-display text-3xl">Create {appraisalKindLabels[product].toLowerCase()} appraisal</h1><p className="mt-3 text-base-content/65">Choose your property, then review the evidence and prepare your proposal.</p></header>
    <fieldset disabled={creating} className="min-w-0"><ClientPicker value={recipient} onChange={setRecipient} errors={clientErrors} initiallyOpen={initialRecipient.mode === "named" && !initialRecipient.name} /></fieldset>
    <PropertyStartFlow busy={creating} initialListing={initialListing} storageKey={storageKey} enforcePhotoMinimum continueLabel="Create appraisal" onContinue={create} />
  </div>;
}
