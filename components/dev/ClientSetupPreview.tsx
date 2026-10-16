"use client";
import { useState } from "react";
import { ClientPicker } from "@/components/clients/ClientPicker";
import type { RecipientValues } from "@/lib/str-appraisals/validation";
const clients = [{ id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412 345 678" }, { id: "00000000-0000-4000-8000-000000000002", name: "Sam Taylor", email: "sam@example.com", phone: "0412 345 679" }];
export function ClientSetupPreview() {
  const [value, setValue] = useState<RecipientValues>({ mode: "general", name: "", email: "", phone: "" });
  return <div data-theme="staypack-workspace" className="max-w-3xl space-y-6 text-base-content"><p className="text-sm text-base-content/60">Development preview · sample contacts · nothing is saved</p><header><h1 className="font-display text-3xl">Create rental appraisal</h1><p className="mt-2 text-base-content/65">Choose your property and who the report is prepared for.</p></header><ClientPicker value={value} onChange={setValue} previewClients={clients} initiallyOpen /><div className="rounded-xl border border-base-300 bg-base-100 p-5"><p className="text-xs text-base-content/60">Property</p><p className="mt-1 font-medium">2/24 Cliffbrook Parade, Clovelly NSW 2031</p><p className="mt-2 text-sm text-base-content/65">2 bedrooms · 1 bathroom</p></div></div>;
}
