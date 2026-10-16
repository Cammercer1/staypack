"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { readPrivateResponse } from "@/components/str-appraisals/useRemoteOptions";
import { recipientSchema, type RecipientValues } from "@/lib/str-appraisals/validation";
import type { CalculatorLead } from "@/lib/str-calculator/schema";
import type { Client } from "@/lib/clients/types";

export function SaveEnquiryContact({ lead, onSaved, onClose }: { lead: CalculatorLead; onSaved: (contact: Client) => void; onClose: () => void }) {
  const form = useForm<RecipientValues>({ resolver: zodResolver(recipientSchema), defaultValues: {
    mode: "named", name: lead.full_name || "", email: lead.email, phone: lead.phone || "",
  } });
  const value = useWatch({ control: form.control }) as RecipientValues;
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  function close() {
    if (form.formState.isSubmitting) return;
    if (form.formState.isDirty) setDiscard(true); else onClose();
  }
  return <>
    <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent data-theme="staypack-workspace" showCloseButton={false} className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-base-100 text-base-content sm:max-w-lg">
      <DialogTitle>Save contact</DialogTitle>
      <DialogDescription>Save this person for follow-up. Their calculator enquiry stays in your inbox.{lead.report_id && " The existing report keeps its saved recipient."}</DialogDescription>
      <form noValidate className="space-y-5" onSubmit={form.handleSubmit(async values => {
        setError("");
        try {
          const result = await readPrivateResponse(await fetch(`/api/marketing/str-calculator/leads/${lead.id}/contact`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
          }));
          onSaved(result.contact);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t save this contact. Please try again."); }
      })}>
        <UnsavedListingGuard dirty={form.formState.isDirty && !form.formState.isSubmitting} description="Your contact details have unsaved changes." />
        <fieldset disabled={form.formState.isSubmitting}>
          <ClientPicker purpose="contact" initiallyOpen value={value} onChange={next => {
            for (const field of ["mode", "contact_id", "name", "email", "phone"] as const) form.setValue(field, next[field], { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
          }} errors={{ name: form.formState.errors.name?.message, email: form.formState.errors.email?.message, phone: form.formState.errors.phone?.message }} />
        </fieldset>
        {error && <p role="alert" className="du-alert du-alert-error text-sm">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={form.formState.isSubmitting} onClick={close} className="du-btn du-btn-sm du-btn-ghost min-h-11">Cancel</button><button type="submit" disabled={form.formState.isSubmitting} className="du-btn du-btn-sm du-btn-primary min-h-11">{form.formState.isSubmitting ? "Saving…" : "Save contact"}</button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={discard} onOpenChange={setDiscard}><DialogContent data-theme="staypack-workspace" className="rounded-2xl bg-base-100 text-base-content"><DialogTitle>Discard contact changes?</DialogTitle><DialogDescription>Your changes have not been saved.</DialogDescription><div className="flex justify-end gap-2"><button type="button" className="du-btn du-btn-sm min-h-11" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" className="du-btn du-btn-sm du-btn-primary min-h-11" onClick={onClose}>Discard changes</button></div></DialogContent></Dialog>
  </>;
}
