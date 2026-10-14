"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import type { StrAppraisal } from "@/lib/str-appraisals/types";
import { AppraisalArchiveControl } from "./AppraisalArchiveControl";
import { RecipientForm } from "./RecipientForm";
import { readPrivateResponse } from "./useRemoteOptions";

export function AppraisalCustomerPanel({ initialAppraisal, archived, onEditingChange, onSaved }: { initialAppraisal: StrAppraisal; archived: boolean; onEditingChange?: (editing: boolean) => void; onSaved?: (appraisal: StrAppraisal) => void }) {
  const paths = useAppraisalRoutes(initialAppraisal.report_id);
  const [appraisal,setAppraisal] = useState(initialAppraisal);
  const [editing,setEditing] = useState(false);
  function changeEditing(next: boolean) { setEditing(next); onEditingChange?.(next); }
  const router = useRouter();
  return <section data-theme="staypack-workspace" className="rounded-xl border border-base-300 bg-base-100 p-5 text-base-content sm:p-6">
    {editing ? <RecipientForm initialValues={{ mode:appraisal.recipient_mode === "general" ? "named" : appraisal.recipient_mode, contact_id:appraisal.contact_id || "", name:appraisal.recipient_name || "", email:appraisal.recipient_email || "", phone:appraisal.recipient_phone || "" }} submitLabel="Save customer details" onCancel={() => changeEditing(false)} onSubmit={async (recipient) => {
      const result = await readPrivateResponse(await fetch(`${paths.api}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ recipient, expected_updated_at:appraisal.updated_at }) }));
      setAppraisal(result.appraisal); changeEditing(false); onSaved?.(result.appraisal); if (!onSaved) router.refresh();
    }} /> : <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 font-medium"><UserRound className="size-4" aria-hidden="true" />{appraisal.recipient_name ? `Prepared for ${appraisal.recipient_name}` : "General appraisal"}</h2><p className="mt-2 break-words text-sm text-base-content/65">{[appraisal.recipient_email,appraisal.recipient_phone].filter(Boolean).join(" · ") || "No customer contact details added."}</p><p className="mt-2 text-xs text-base-content/60">Private to your agency · No message sent</p></div><div className="flex flex-wrap gap-2">{!archived && <button className="du-btn du-btn-sm min-h-11" onClick={() => changeEditing(true)}>{appraisal.recipient_mode === "named" ? "Edit customer" : "Add customer"}</button>}{archived && <AppraisalArchiveControl reportId={appraisal.report_id} archived />}</div></div>}
  </section>;
}
