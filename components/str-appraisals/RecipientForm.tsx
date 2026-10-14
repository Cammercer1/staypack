"use client";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockKeyhole, UserRound } from "lucide-react";
import { recipientSchema, type RecipientValues } from "@/lib/str-appraisals/validation";
import type { AgencyContact } from "@/lib/str-appraisals/types";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { useRemoteOptions } from "./useRemoteOptions";

export function RecipientForm({ initialValues, onSubmit, submitLabel, onCancel }: {
  initialValues: RecipientValues;
  onSubmit: (values: RecipientValues) => Promise<void>;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const id = useId();
  const form = useForm<RecipientValues>({ resolver: zodResolver(recipientSchema), defaultValues: initialValues, mode: "onBlur" });
  const mode = useWatch({ control: form.control, name: "mode" });
  const contactId = useWatch({ control: form.control, name: "contact_id" });
  const [contactSearch, setContactSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const contacts = useRemoteOptions<AgencyContact>(`/api/str/contacts?q=${encodeURIComponent(contactSearch)}`, "contacts", mode === "named");
  async function save(values: RecipientValues) {
    setError(null);
    try { await onSubmit(values); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save customer details."); }
  }
  return (
    <form onSubmit={form.handleSubmit(save)} noValidate className="space-y-5">
      <UnsavedListingGuard dirty={form.formState.isDirty && !form.formState.isSubmitting && !saved} description="Your customer details have unsaved changes. Stay to save them, or discard them and leave." />
      <fieldset disabled={form.formState.isSubmitting} className="space-y-5">
        <legend className="mb-4 flex items-center gap-2 font-medium"><UserRound className="size-4" aria-hidden="true" />Prepared for</legend>
        <div>
          <label htmlFor={`${id}-mode`} className="mb-2 block text-sm font-medium">Appraisal audience</label>
          <select id={`${id}-mode`} aria-label="Appraisal audience" className="du-select du-select-sm min-h-11 w-full sm:max-w-sm" {...form.register("mode")}>
            <option value="named">A specific customer</option><option value="general">General appraisal — no named customer</option>
          </select>
        </div>
        {mode === "named" && <>
          <div className="space-y-2">
            <label htmlFor={`${id}-contact-search`} className="block text-sm font-medium">Find an existing customer <span className="font-normal text-base-content/60">(optional)</span></label>
            <input id={`${id}-contact-search`} aria-label="Find an existing customer (optional)" type="search" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Search customer names" className="du-input du-input-sm min-h-11 w-full sm:max-w-sm" />
            <label htmlFor={`${id}-contact`} className="sr-only">Existing customer</label>
            <select id={`${id}-contact`} aria-label="Existing customer" value={contactId || ""} className="du-select du-select-sm min-h-11 w-full" onChange={(event) => {
              const contact = contacts.data.find((item) => item.id === event.target.value);
              form.setValue("contact_id", event.target.value, { shouldDirty: true });
              if (contact) for (const field of ["name", "email", "phone"] as const) form.setValue(field, contact[field] || "", { shouldDirty: true, shouldValidate: true });
            }}>
              <option value="">Create a new customer</option>
              {contactId && !contacts.data.some((item) => item.id === contactId) && <option value={contactId}>Current customer</option>}
              {contacts.data.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.email ? ` · ${contact.email}` : ""}</option>)}
            </select>
            <p className="text-xs text-base-content/65" role="status">{contacts.loading ? "Loading customers…" : contacts.error || "Select a customer or enter new details below."}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {([{ name: "name", label: "Customer name", type: "text", autoComplete: "name" }, { name: "email", label: "Email (optional)", type: "email", autoComplete: "email" }, { name: "phone", label: "Phone (optional)", type: "tel", autoComplete: "tel" }] as const).map((field) => <div key={field.name} className={field.name === "name" ? "sm:col-span-2" : ""}>
              <label htmlFor={`${id}-${field.name}`} className="mb-2 block text-sm font-medium">{field.label}</label>
              <input id={`${id}-${field.name}`} aria-label={field.label} type={field.type} autoComplete={field.autoComplete} maxLength={field.name === "name" ? 200 : field.name === "email" ? 254 : 50} aria-invalid={Boolean(form.formState.errors[field.name])} aria-describedby={`${id}-${field.name}-hint`} className="du-input du-input-sm min-h-11 w-full" {...form.register(field.name)} />
              <p id={`${id}-${field.name}-hint`} className="mt-1 text-xs text-error" role={form.formState.errors[field.name] ? "alert" : undefined}>{form.formState.errors[field.name]?.message}</p>
            </div>)}
          </div>
          <p className="text-xs text-base-content/65">Australian numbers are accepted locally. For other countries, include the + country code. Editing these details applies to this appraisal.</p>
        </>}
      </fieldset>
      <p className="flex items-start gap-2 text-sm text-base-content/65"><LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Customer details are private to your agency. They are not added to the PDF or public report. Saving does not send a message.</span></p>
      {error && <div role="alert" className="du-alert du-alert-error">{error}</div>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={form.formState.isSubmitting} className="du-btn du-btn-sm du-btn-primary min-h-11">{form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{form.formState.isSubmitting ? "Saving…" : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} disabled={form.formState.isSubmitting} className="du-btn du-btn-sm du-btn-ghost min-h-11">Cancel</button>}
      </div>
    </form>
  );
}
