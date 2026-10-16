"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockKeyhole } from "lucide-react";
import { recipientSchema, type RecipientValues } from "@/lib/str-appraisals/validation";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { ClientPicker } from "@/components/clients/ClientPicker";

export function RecipientForm({ initialValues, onSubmit, submitLabel, onCancel }: {
  initialValues: RecipientValues;
  onSubmit: (values: RecipientValues) => Promise<void>;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const form = useForm<RecipientValues>({ resolver: zodResolver(recipientSchema), defaultValues: initialValues, mode: "onBlur" });
  const values = useWatch({ control: form.control }) as RecipientValues;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function save(values: RecipientValues) {
    setError(null);
    try { await onSubmit(values); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save contact details."); }
  }
  return <form data-theme="staypack-workspace" onSubmit={form.handleSubmit(save)} noValidate className="space-y-5 text-base-content">
    <UnsavedListingGuard dirty={form.formState.isDirty && !form.formState.isSubmitting && !saved} description="Your contact details have unsaved changes. Stay to save them, or discard them and leave." />
    <fieldset disabled={form.formState.isSubmitting} className="min-w-0"><legend className="sr-only">Contact details</legend>
      <ClientPicker initiallyOpen value={values} onChange={next => { for (const field of ["mode", "contact_id", "name", "email", "phone"] as const) form.setValue(field, next[field], { shouldDirty: true, shouldValidate: form.formState.isSubmitted }); }} errors={{ name: form.formState.errors.name?.message, email: form.formState.errors.email?.message, phone: form.formState.errors.phone?.message }} />
    </fieldset>
    <p className="flex items-start gap-2 text-xs leading-relaxed text-base-content/65"><LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>The contact name appears on the proposal. Email and phone stay private to your agency. Saving does not send a message.</span></p>
    {error && <div role="alert" className="du-alert du-alert-error">{error}</div>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 pt-5">
      {onCancel && <button type="button" onClick={onCancel} disabled={form.formState.isSubmitting} className="du-btn du-btn-sm du-btn-ghost min-h-11">Cancel</button>}
      <button type="submit" disabled={form.formState.isSubmitting} className="du-btn du-btn-sm du-btn-primary min-h-11">{form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{form.formState.isSubmitting ? "Saving…" : submitLabel}</button>
    </div>
  </form>;
}
