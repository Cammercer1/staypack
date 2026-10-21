"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, UserRound, UsersRound, X } from "lucide-react";
import type { StrAppraisal } from "@/lib/str-appraisals/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppraisalArchiveControl } from "./AppraisalArchiveControl";
import { RecipientForm } from "./RecipientForm";
import { readPrivateResponse } from "./useRemoteOptions";

export function AppraisalCustomerPanel({ initialAppraisal, archived, onEditingChange, onSaved, layout = "compact" }: { initialAppraisal: StrAppraisal; archived: boolean; onEditingChange?: (editing: boolean) => void; onSaved?: (appraisal: StrAppraisal) => void; layout?: "compact" | "card" | "inline" }) {
  const paths = useAppraisalRoutes(initialAppraisal.report_id);
  const [appraisal, setAppraisal] = useState(initialAppraisal);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const headingId = useId();
  function changeEditing(next: boolean) { setEditing(next); onEditingChange?.(next); }
  const router = useRouter();
  const named = appraisal.recipient_mode === "named";
  const card = layout === "card";
  const inline = layout === "inline";
  const hasDetails = named || appraisal.client_review_required || appraisal.recipient_email || appraisal.recipient_phone || appraisal.client_pending_json?.email;
  const icon = <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-base-200 text-primary">{named ? <UserRound className="size-5" aria-hidden="true" /> : <UsersRound className="size-5" aria-hidden="true" />}</span>;
  const details = <>
    {(named || appraisal.client_review_required) && <p className="break-words font-medium">{named ? appraisal.recipient_name : appraisal.client_pending_json?.reason === "identity_conflict" ? "Review contact details" : "Add contact name"}</p>}
    {(appraisal.recipient_email || appraisal.recipient_phone || appraisal.client_pending_json?.email) && <p className="break-all text-xs text-base-content/65">{[appraisal.recipient_email || appraisal.client_pending_json?.email, appraisal.recipient_phone || appraisal.client_pending_json?.phone].filter(Boolean).join(" · ")}</p>}
    {appraisal.client_review_required && <p className="mt-1 text-xs text-base-content/65">Review the calculator enquiry details before sharing.</p>}
  </>;
  const action = archived ? <AppraisalArchiveControl reportId={appraisal.report_id} archived /> : <DialogTrigger render={<button type="button" className={card ? "du-btn du-btn-sm du-btn-outline min-h-11" : "du-btn du-btn-sm du-btn-ghost min-h-11"} />}>
    {named ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}{named ? "Change client" : "Add client"}
  </DialogTrigger>;
  return <Dialog open={editing} onOpenChange={next => { if (!saving) changeEditing(next); }}>
    <section data-theme="staypack-workspace" aria-labelledby={headingId} className={inline ? "flex min-w-0 flex-wrap items-center justify-between gap-3 text-base-content" : card ? "du-card du-card-border min-w-0 self-start bg-base-100 text-base-content" : "flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-4 text-base-content"}>
      {inline ? <>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 id={headingId} className="text-sm font-medium">Prepared for</h2><span aria-hidden="true" className="text-base-content/40">·</span><span className="text-xs text-base-content/60">Optional</span></div>
          {hasDetails && <div className="mt-1 space-y-0.5 text-sm">{details}</div>}
        </div>
        {action}
      </> : card ? <div className="du-card-body gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id={headingId} className="du-card-title text-base">Prepared for</h2><span className="du-badge du-badge-sm du-badge-ghost">Optional</span></div>
        {hasDetails && <div className="flex min-w-0 items-start gap-3">{icon}<div className="min-w-0 flex-1">{details}</div></div>}
        <div className="du-card-actions justify-start">{action}</div>
      </div> : <>
      {icon}
      <div className="min-w-0 flex-1"><h2 id={headingId} className="text-xs text-base-content/60">Prepared for</h2>{details}
        {!named && !appraisal.client_review_required && <p className="mt-1 text-xs text-base-content/65">Optional</p>}
      </div>
      {action}
      </>}
    </section>
    <DialogContent data-theme="staypack-workspace" showCloseButton={false} className="max-h-[90dvh] gap-0 overflow-y-auto rounded-2xl bg-base-100 p-0 text-base-content sm:max-w-xl">
      <div className="flex items-start justify-between gap-4 border-b border-base-300 px-5 py-5 sm:px-6">
        <div><DialogTitle className="text-xl">{named ? "Change client" : "Add client"}</DialogTitle><DialogDescription className="mt-2 text-base-content/65">Choose who this proposal is prepared for.</DialogDescription></div>
        <button type="button" aria-label="Close contact details" disabled={saving} onClick={() => changeEditing(false)} className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11"><X className="size-5" aria-hidden="true" /></button>
      </div>
      {editing && <div className="p-5 sm:p-6"><RecipientForm initialValues={{ mode: "named", contact_id: appraisal.contact_id || "", name: appraisal.recipient_name || appraisal.client_pending_json?.name || "", email: appraisal.recipient_email || appraisal.client_pending_json?.email || "", phone: appraisal.recipient_phone || appraisal.client_pending_json?.phone || "" }} submitLabel="Save contact details" onCancel={() => changeEditing(false)} onSubmit={async recipient => {
        setSaving(true);
        try {
          const result = await readPrivateResponse(await fetch(paths.api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient, expected_updated_at: appraisal.updated_at }) }));
          setAppraisal(result.appraisal); changeEditing(false); onSaved?.(result.appraisal); if (!onSaved) router.refresh();
        } finally { setSaving(false); }
      }} /></div>}
    </DialogContent>
  </Dialog>;
}
