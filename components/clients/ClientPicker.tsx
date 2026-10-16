"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Mail, Phone, Plus, Search, UserRound } from "lucide-react";
import type { RecipientValues } from "@/lib/str-appraisals/validation";
import type { AgencyContact } from "@/lib/str-appraisals/types";
import { useRemoteOptions } from "@/components/str-appraisals/useRemoteOptions";
import { ExistingClientNotice } from "./ExistingClientNotice";

type Errors = Partial<Record<"name" | "email" | "phone", string>>;
export function ClientDetailsFields({ value, onChange, errors = {} }: { value: RecipientValues; onChange: (value: RecipientValues) => void; errors?: Errors }) {
  const id = useId();
  return <div className="grid gap-3 sm:grid-cols-2">
    {([{ name: "name", label: "Contact name", type: "text", autoComplete: "name", icon: UserRound }, { name: "email", label: "Email (optional)", type: "email", autoComplete: "email", icon: Mail }, { name: "phone", label: "Phone (optional)", type: "tel", autoComplete: "tel", icon: Phone }] as const).map(field => <div key={field.name} className={field.name === "name" ? "sm:col-span-2" : ""}>
      <label htmlFor={`${id}-${field.name}`} className="mb-1.5 block text-sm font-medium">{field.label}</label>
      <div className={errors[field.name] ? "du-input du-input-sm du-input-error min-h-11 w-full" : "du-input du-input-sm min-h-11 w-full"}><field.icon className="size-4 shrink-0 text-base-content/55" aria-hidden="true" /><input id={`${id}-${field.name}`} aria-label={field.label} type={field.type} autoComplete={field.autoComplete} maxLength={field.name === "name" ? 200 : field.name === "email" ? 254 : 50} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : undefined} value={value[field.name]} onChange={event => onChange({ ...value, [field.name]: event.target.value })} className="min-w-0" /></div>
      {errors[field.name] && <p id={`${id}-${field.name}-error`} role="alert" className="mt-1 text-xs text-error">{errors[field.name]}</p>}
    </div>)}
  </div>;
}

/** One picker for new reports and report-specific recipient snapshots. */
export function ClientPicker({ value, onChange, errors, initiallyOpen = false, previewClients, purpose = "report" }: { value: RecipientValues; onChange: (value: RecipientValues) => void; errors?: Errors; initiallyOpen?: boolean; previewClients?: AgencyContact[]; purpose?: "report" | "contact" }) {
  const id = useId();
  const [open, setOpen] = useState(initiallyOpen);
  const [editing, setEditing] = useState(initiallyOpen && value.mode === "named" && Boolean(value.name || value.email || value.phone));
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const changeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => { if (!open && restoreFocus.current) { changeButton.current?.focus(); restoreFocus.current = false; } }, [open]);
  useEffect(() => { if (activeIndex >= 0) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" }); }, [activeIndex, id]);
  const remote = useRemoteOptions<AgencyContact>(`/api/clients?q=${encodeURIComponent(search)}`, "clients", open && !editing && !previewClients);
  const contacts = previewClients ? { data: previewClients.filter(client => [client.name, client.email, client.phone].some(value => value?.toLowerCase().includes(search.toLowerCase()))), loading: false, error: null } : remote;
  function choose(contact: AgencyContact) {
    onChange({ mode: "named", contact_id: contact.id, name: contact.name, email: contact.email || "", phone: contact.phone || "" });
    restoreFocus.current = true; setOpen(false); setEditing(false); setSearch(""); setActiveIndex(-1);
  }
  function add() {
    onChange({ mode: "named", contact_id: "", name: search.includes("@") ? "" : search, email: search.includes("@") ? search : "", phone: "" });
    setEditing(true);
  }
  const named = value.mode === "named";
  return <div className="space-y-3">
    {!open ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
      <UserRound className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="text-xs text-base-content/60">{purpose === "contact" ? "Contact to save" : "Prepared for"}</p><p className="break-words font-medium">{named ? value.name || "Add contact name" : "No named contact"}</p>{named && (value.email || value.phone) && <p className="break-all text-xs text-base-content/65">{[value.email, value.phone].filter(Boolean).join(" · ")}</p>}</div>
      <button ref={changeButton} type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => { setOpen(true); setEditing(false); }}>Change contact</button>
      {named && purpose === "report" && <button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => { setOpen(true); setEditing(true); }}>Edit details</button>}
    </div> : <>
      {!editing ? <div className="space-y-2">
        <label htmlFor={`${id}-search`} className="block text-sm font-medium">Search contacts</label>
        <div className="du-input min-h-12 w-full"><Search className="size-4 shrink-0 text-base-content/55" aria-hidden="true" /><input id={`${id}-search`} aria-label="Search contacts" role="combobox" aria-autocomplete="list" aria-expanded={true} aria-controls={`${id}-results`} aria-activedescendant={activeIndex >= 0 && activeIndex < contacts.data.length ? `${id}-option-${activeIndex}` : undefined} autoComplete="off" placeholder="Name, email or phone" value={search} maxLength={160} onChange={event => { setSearch(event.target.value); setActiveIndex(-1); }} onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(current => contacts.data.length ? (current < 0 ? (event.key === "ArrowDown" ? 0 : contacts.data.length - 1) : (current + (event.key === "ArrowDown" ? 1 : -1) + contacts.data.length) % contacts.data.length) : -1); }
          if (event.key === "Enter") { event.preventDefault(); if (activeIndex >= 0 && contacts.data[activeIndex]) choose(contacts.data[activeIndex]); }
          if (event.key === "Escape") { event.preventDefault(); restoreFocus.current = true; setOpen(false); }
        }} /></div>
        <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
          <ul id={`${id}-results`} role="listbox" aria-label="Contacts" className="max-h-64 overflow-y-auto">
            {contacts.data.map((contact, index) => <li key={contact.id} role="presentation"><button type="button" id={`${id}-option-${index}`} role="option" aria-selected={value.contact_id === contact.id} onMouseDown={event => event.preventDefault()} onClick={() => choose(contact)} className={activeIndex === index ? "flex min-h-14 w-full items-center gap-3 bg-base-200 px-4 py-3 text-left disabled:cursor-not-allowed" : "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-base-200/60 disabled:cursor-not-allowed"}>
              <UserRound className="size-4 shrink-0 text-base-content/55" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{contact.name || "Name needed"}</span><span className="block truncate text-xs text-base-content/65">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details"}</span></span>{value.contact_id === contact.id && <Check className="size-4 text-primary" aria-hidden="true" />}
            </button></li>)}
          </ul>
          <p role="status" className="px-4 py-2 text-xs text-base-content/60">{contacts.loading ? "Finding contacts…" : contacts.error || (contacts.data.length ? "Select a contact or add someone new." : "No matching contacts.")}</p>
          <button type="button" onClick={add} className="flex min-h-12 w-full items-center gap-2 border-t border-base-300 px-4 text-left text-sm font-medium text-primary hover:bg-base-200/50"><Plus className="size-4" aria-hidden="true" />Add new contact</button>
        </div>
      </div> : <div className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
        <div className="flex items-center justify-between gap-2"><p className="font-medium">{value.contact_id ? "Details for this report" : "New contact"}</p><button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => setEditing(false)}>Search contacts</button></div>
        <ClientDetailsFields value={value} onChange={onChange} errors={errors} />
        {!value.contact_id && <ExistingClientNotice email={value.email} onSelect={choose} previewClients={previewClients} />}
        <p className="text-xs text-base-content/60">{purpose === "contact" ? "Saving keeps this enquiry linked to the contact." : value.contact_id ? "These changes apply to this report. Edit the Contacts directory to update the saved contact." : "This contact will be saved when you continue."}</p>
      </div>}
      {purpose === "report" && <button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => { onChange({ mode: "general", name: "", email: "", phone: "", contact_id: "" }); restoreFocus.current = true; setOpen(false); setEditing(false); }}>No named contact</button>}
    </>}
    {!editing && errors && Object.values(errors).some(Boolean) && <div className="space-y-2"><p role="alert" className="text-sm text-error">{[errors.name, errors.email, errors.phone].filter(Boolean).join(" ")}</p>{open && named && <button type="button" className="du-btn du-btn-sm min-h-11" onClick={() => setEditing(true)}>Review entered details</button>}</div>}
  </div>;
}
