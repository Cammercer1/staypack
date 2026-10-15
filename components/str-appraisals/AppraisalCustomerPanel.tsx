"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, Pencil, Phone, Plus, UserRound, UsersRound, X } from "lucide-react";
import type { StrAppraisal } from "@/lib/str-appraisals/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppraisalArchiveControl } from "./AppraisalArchiveControl";
import { RecipientForm } from "./RecipientForm";
import { readPrivateResponse } from "./useRemoteOptions";

export function AppraisalCustomerPanel({ initialAppraisal, archived, onEditingChange, onSaved }: { initialAppraisal: StrAppraisal; archived: boolean; onEditingChange?: (editing: boolean) => void; onSaved?: (appraisal: StrAppraisal) => void }) {
  const paths = useAppraisalRoutes(initialAppraisal.report_id);
  const [appraisal, setAppraisal] = useState(initialAppraisal);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const headingId = useId();
  function changeEditing(next: boolean) { setEditing(next); onEditingChange?.(next); }
  const router = useRouter();
  const named = appraisal.recipient_mode === "named";
  return <Dialog open={editing} onOpenChange={next => { if (!saving) changeEditing(next); }}>
    <section data-theme="staypack-workspace" aria-labelledby={headingId} className="du-card du-card-border min-w-0 bg-base-100 text-base-content">
      <div className="du-card-body gap-5 p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id={headingId} className="du-card-title text-base">Customer</h2><p className="mt-1 text-xs text-base-content/65">Who this proposal is prepared for.</p></div>
          <div className="du-card-actions">
            {!archived && <DialogTrigger render={<button type="button" className="du-btn du-btn-sm min-h-11" />}>
              {named ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}{named ? "Edit customer" : "Add customer"}
            </DialogTrigger>}
            {archived && <AppraisalArchiveControl reportId={appraisal.report_id} archived />}
          </div>
        </header>
        <div className="flex items-start gap-4 rounded-xl bg-base-200/60 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-base-100 text-primary">{named ? <UserRound className="size-5" aria-hidden="true" /> : <UsersRound className="size-5" aria-hidden="true" />}</span>
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold">{named ? appraisal.recipient_name : "General appraisal"}</h3>
            <p className="mt-1 text-sm text-base-content/65">{named ? "This name appears on the proposal." : "No customer name will appear on the proposal."}</p>
            {named && <div className="mt-3 space-y-2 text-sm text-base-content/75">
              {appraisal.recipient_email && <p className="flex items-start gap-2"><Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-all">{appraisal.recipient_email}</span></p>}
              {appraisal.recipient_phone && <p className="flex items-start gap-2"><Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{appraisal.recipient_phone}</span></p>}
              {!appraisal.recipient_email && !appraisal.recipient_phone && <p>No email or phone added.</p>}
            </div>}
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-base-content/65"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span>Email and phone stay private to your agency. Saving does not send a message.</span></p>
      </div>
    </section>
    <DialogContent data-theme="staypack-workspace" showCloseButton={false} className="max-h-[90dvh] gap-0 overflow-y-auto rounded-2xl bg-base-100 p-0 text-base-content sm:max-w-xl">
      <div className="flex items-start justify-between gap-4 border-b border-base-300 px-5 py-5 sm:px-6">
        <div><DialogTitle className="text-xl">{named ? "Edit customer" : "Add customer"}</DialogTitle><DialogDescription className="mt-2 text-base-content/65">Choose who this proposal is prepared for.</DialogDescription></div>
        <button type="button" aria-label="Close customer details" disabled={saving} onClick={() => changeEditing(false)} className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"><X className="size-5" aria-hidden="true" /></button>
      </div>
      {editing && <div className="p-5 sm:p-6"><RecipientForm initialValues={{ mode: "named", contact_id: appraisal.contact_id || "", name: appraisal.recipient_name || "", email: appraisal.recipient_email || "", phone: appraisal.recipient_phone || "" }} submitLabel="Save customer details" onCancel={() => changeEditing(false)} onSubmit={async recipient => {
        setSaving(true);
        try {
          const result = await readPrivateResponse(await fetch(paths.api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient, expected_updated_at: appraisal.updated_at }) }));
          setAppraisal(result.appraisal); changeEditing(false); onSaved?.(result.appraisal); if (!onSaved) router.refresh();
        } finally { setSaving(false); }
      }} /></div>}
    </DialogContent>
  </Dialog>;
}
