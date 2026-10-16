"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArrowLeft, ArrowRight, Mail, Phone, Plus, Search, UserRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { recipientSchema, type RecipientValues } from "@/lib/str-appraisals/validation";
import { appraisalKindLabels, appraisalPath } from "@/lib/appraisals/workspaceTypes";
import { readPrivateResponse } from "@/components/str-appraisals/useRemoteOptions";
import type { Client, ClientDetail, ClientListResult } from "@/lib/clients/types";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { ClientDetailsFields } from "./ClientPicker";
import { enquiryProgress } from "@/lib/str-calculator/enquiryProgress";
import { ExistingClientNotice } from "./ExistingClientNotice";

function ClientEditor({ client, onSaved, onViewExisting, onCancel, onBusy, onDirty }: { client: Client | null; onSaved: (client: Client) => void; onViewExisting: (clientId: string) => void; onCancel: () => void; onBusy: (busy: boolean) => void; onDirty: (dirty: boolean) => void }) {
  const form = useForm<RecipientValues>({ resolver: zodResolver(recipientSchema), defaultValues: { mode: "named", name: client?.name ?? "", email: client?.email ?? "", phone: client?.phone ?? "" } });
  const value = useWatch({ control: form.control }) as RecipientValues;
  const [error, setError] = useState("");
  useEffect(() => { onDirty(form.formState.isDirty); }, [form.formState.isDirty, onDirty]);
  return <form noValidate className="space-y-5" onSubmit={form.handleSubmit(async values => {
    onBusy(true); setError("");
    try {
      const result = await readPrivateResponse(await fetch(client ? `/api/clients/${client.id}` : "/api/clients", { method: client ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.name, email: values.email, phone: values.phone, ...(client ? { archived: Boolean(client.archived_at), expected_updated_at: client.updated_at } : {}) }) }));
      onSaved(result.client);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this contact."); }
    finally { onBusy(false); }
  })}>
    <UnsavedListingGuard dirty={form.formState.isDirty && !form.formState.isSubmitting} description="Your contact details have unsaved changes. Save them before leaving." />
    <fieldset disabled={form.formState.isSubmitting} className="space-y-4"><ClientDetailsFields value={value} onChange={next => { for (const key of ["name", "email", "phone"] as const) form.setValue(key, next[key], { shouldDirty: true, shouldValidate: form.formState.isSubmitted }); }} errors={{ name: form.formState.errors.name?.message, email: form.formState.errors.email?.message, phone: form.formState.errors.phone?.message }} /><ExistingClientNotice email={value.email} excludeId={client?.id} onView={onViewExisting} /></fieldset>
    <p className="text-xs text-base-content/65">These details are private to your agency. Changes here apply to future selections; existing reports keep their saved contact details.</p>
    {error && <p role="alert" className="du-alert du-alert-error">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" disabled={form.formState.isSubmitting} onClick={onCancel} className="du-btn du-btn-sm du-btn-ghost min-h-11">Cancel</button><button type="submit" disabled={form.formState.isSubmitting} className="du-btn du-btn-sm du-btn-primary min-h-11">{form.formState.isSubmitting ? "Saving…" : "Save contact"}</button></div>
  </form>;
}

export function ClientsDirectory({ initialClientId }: { initialClientId?: string }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState("active");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ClientListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailId, setDetailId] = useState<string | null>(initialClientId ?? null);
  const [detailError, setDetailError] = useState("");
  const [editor, setEditor] = useState<Client | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  function closeEditor() { if (busy) return; if (editorDirty) setConfirmDiscard(true); else setEditor(null); }
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try { const data = await readPrivateResponse(await fetch(`/api/clients?q=${encodeURIComponent(query)}&page=${page}&archived=${archived}`, { signal: controller.signal, cache: "no-store" })); if (!controller.signal.aborted) setResult(data); }
      catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load contacts."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, page, archived, revision]);
  useEffect(() => {
    if (!detailId) return;
    const controller = new AbortController();
    void fetch(`/api/clients/${detailId}`, { signal: controller.signal, cache: "no-store" }).then(readPrivateResponse).then(data => { if (!controller.signal.aborted) setDetail(data); }).catch(cause => { if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : "Unable to load contact details."); });
    return () => controller.abort();
  }, [detailId, revision]);
  function openClient(client: Client) { setDetail(null); setDetailError(""); setDetailId(client.id); }
  async function toggleArchive(client: Client) {
    setBusy(true); setDetailError("");
    try {
      await readPrivateResponse(await fetch(`/api/clients/${client.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: client.name, email: client.email || "", phone: client.phone || "", archived: !client.archived_at, expected_updated_at: client.updated_at }) }));
      setRevision(value => value + 1);
    } catch (cause) { setDetailError(cause instanceof Error ? cause.message : "Unable to update contact."); }
    finally { setBusy(false); }
  }
  const counts = detail?.reportCounts;
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize || 30)));
  return <div data-theme="staypack-workspace" className="space-y-7 text-base-content">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-3xl">Contacts</h1><p className="mt-2 text-base-content/65">People you’ve saved or prepared reports for.</p></div><button type="button" onClick={() => { setEditorDirty(false); setEditor("new"); }} className="du-btn du-btn-primary min-h-11"><Plus className="size-4" aria-hidden="true" />Add contact</button></header>
    <div className="flex flex-wrap gap-3"><label htmlFor={searchId} className="du-input min-h-12 w-full sm:max-w-md"><Search className="size-4" aria-hidden="true" /><input id={searchId} aria-label="Search contacts" type="search" placeholder="Name, email or phone" value={query} maxLength={160} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><select aria-label="Contact status" className="du-select min-h-12 w-full sm:w-auto" value={archived} onChange={event => { setArchived(event.target.value); setPage(1); }}><option value="active">Active contacts</option><option value="archived">Archived contacts</option><option value="all">All contacts</option></select></div>
    {error && <p role="alert" className="du-alert du-alert-error">{error}</p>}
    {loading ? <p role="status" className="py-8 text-base-content/60">Loading contacts…</p> : result?.clients.length ? <ul className="divide-y divide-base-300 overflow-hidden rounded-2xl border border-base-300 bg-base-100">
      {result.clients.map(client => <li key={client.id}><button type="button" onClick={() => openClient(client)} className="flex min-h-24 w-full items-center gap-4 px-5 py-4 text-left hover:bg-base-200/60 focus-visible:outline-2 focus-visible:outline-primary"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-base-200"><UserRound className="size-5 text-primary" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block break-words font-medium">{client.name}{client.archived_at && <span className="du-badge du-badge-sm ml-2">Archived</span>}</span><span className="mt-1 block break-all text-sm text-base-content/65">{[client.email, client.phone].filter(Boolean).join(" · ") || "No contact details"}</span></span><ArrowRight className="size-4 shrink-0 text-base-content/55" aria-hidden="true" /></button></li>)}
    </ul> : !error && <div className="rounded-2xl border border-dashed border-base-300 p-8"><h2 className="text-lg font-medium">{query ? "No matching contacts" : "No contacts here yet"}</h2><p className="mt-2 text-sm text-base-content/65">{query ? "Try a different name, email or phone number." : "Add a contact, save a calculator enquiry or create a report to get started."}</p></div>}
    {!loading && result && result.total > 0 && <div className="flex items-center justify-between gap-3 text-sm"><span>{result.total} contact{result.total === 1 ? "" : "s"} · Page {page} of {pages}</span><div className="flex gap-2"><button type="button" className="du-btn du-btn-sm min-h-11" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ArrowLeft className="size-4" aria-hidden="true" />Previous</button><button type="button" className="du-btn du-btn-sm min-h-11" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next<ArrowRight className="size-4" aria-hidden="true" /></button></div></div>}
    <Dialog open={Boolean(detailId)} onOpenChange={open => { if (!open && !busy) setDetailId(null); }}><DialogContent data-theme="staypack-workspace" showCloseButton={false} className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-base-100 text-base-content sm:max-w-2xl">
      <div className="flex items-start justify-between gap-3"><div><DialogTitle className="text-2xl">{detail?.client.name || "Contact details"}</DialogTitle><DialogDescription className="mt-1 text-base-content/65">Private contact record and linked activity.</DialogDescription></div><button type="button" aria-label="Close contact record" disabled={busy} onClick={() => setDetailId(null)} className="du-btn du-btn-sm du-btn-ghost min-h-11"><X className="size-5" aria-hidden="true" /></button></div>
      {detailError && <p role="alert" className="du-alert du-alert-error">{detailError}</p>}
      {!detail && !detailError && <p role="status">Loading contact…</p>}
      {detail && <><div className="space-y-2 text-sm">{detail.client.email && <p className="flex items-center gap-2"><Mail className="size-4 shrink-0" aria-hidden="true" /><a className="break-all underline" href={`mailto:${detail.client.email}`}>{detail.client.email}</a></p>}{detail.client.phone && <p className="flex items-center gap-2"><Phone className="size-4 shrink-0" aria-hidden="true" /><a className="underline" href={`tel:${detail.client.phone_e164 || detail.client.phone}`}>{detail.client.phone}</a></p>}</div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setEditorDirty(false); setEditor(detail.client); setDetailId(null); }} className="du-btn du-btn-sm min-h-11">Edit contact</button><button type="button" disabled={busy} onClick={() => void toggleArchive(detail.client)} className="du-btn du-btn-sm du-btn-ghost min-h-11"><Archive className="size-4" aria-hidden="true" />{detail.client.archived_at ? "Restore contact" : "Archive contact"}</button></div>
        <section className="border-t border-base-300 pt-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Reports <span className="text-base-content/60">({detail.reportsTotal})</span></h2>{counts && <p className="mt-1 text-sm text-base-content/65">{counts.draft} draft{counts.draft === 1 ? "" : "s"} · {counts.published} published{counts.archived > 0 ? ` · ${counts.archived} archived` : ""}</p>}</div>{!detail.client.archived_at && <details className="du-dropdown du-dropdown-end"><summary className="du-btn du-btn-sm min-h-11"><Plus className="size-4" aria-hidden="true" />Create report</summary><ul className="du-dropdown-content du-menu z-10 mt-1 w-56 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg">{([{ kind: "str", label: "Short-term rental" }, { kind: "lease", label: "Lease appraisal" }, { kind: "sales", label: "Sales appraisal" }] as const).map(option => <li key={option.kind}><Link href={option.kind === "str" ? `/short-term-rentals/appraisals/new?contact_id=${detail.client.id}` : `/appraisals/new?kind=${option.kind}&contact_id=${detail.client.id}`}>{option.label}</Link></li>)}</ul></details>}</div>{detail.reports.length ? <ul className="mt-2 divide-y divide-base-300">{detail.reports.map(report => <li key={report.id}><Link href={appraisalPath(report.id, report.kind)} className="block py-3 hover:text-primary"><span className="block font-medium">{report.address || "Property report"}</span><span className="text-xs text-base-content/65">{appraisalKindLabels[report.kind]} · {report.status === "draft" ? "Draft" : report.status === "published" ? "Published" : report.status === "unpublished" ? "Unpublished" : report.status === "archived" ? "Archived" : report.status}</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-base-content/65">No reports yet.</p>}{detail.reportsTotal > detail.reports.length && <p className="text-xs text-base-content/65">Showing the latest {detail.reports.length} reports.</p>}</section>
        <section className="border-t border-base-300 pt-4"><h2 className="font-semibold">Calculator enquiries <span className="text-base-content/60">({detail.leadsTotal})</span></h2>{detail.leads.length ? <ul className="mt-2 divide-y divide-base-300">{detail.leads.map(lead => <li key={lead.id} className="py-3"><p className="font-medium">{lead.address}</p><p className="mt-1 text-xs text-base-content/65">{new Date(lead.created_at).toLocaleDateString("en-AU")} · {enquiryProgress({ ...lead, contact_id: detail.client.id })}</p>{lead.report_id && <Link className="mt-2 inline-block text-sm underline" href={appraisalPath(lead.report_id, "str")}>Open report</Link>}</li>)}</ul> : <p className="mt-2 text-sm text-base-content/65">No linked enquiries yet.</p>}{detail.leadsTotal > detail.leads.length && <p className="text-xs text-base-content/65">Showing the latest {detail.leads.length} enquiries.</p>}</section>
      </>}
    </DialogContent></Dialog>
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open) closeEditor(); }}><DialogContent data-theme="staypack-workspace" showCloseButton={false} className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-base-100 text-base-content sm:max-w-xl"><DialogTitle className="text-2xl">{editor === "new" ? "Add contact" : "Edit contact"}</DialogTitle><DialogDescription className="text-base-content/65">Save the details your team will use for future reports.</DialogDescription>{editor && <ClientEditor key={editor === "new" ? "new" : editor.id} client={editor === "new" ? null : editor} onBusy={setBusy} onDirty={setEditorDirty} onCancel={closeEditor} onViewExisting={clientId => { setEditor(null); setEditorDirty(false); setDetail(null); setDetailError(""); setDetailId(clientId); }} onSaved={client => { setEditor(null); setRevision(value => value + 1); openClient(client); }} />}</DialogContent></Dialog>
    <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}><DialogContent data-theme="staypack-workspace" className="rounded-2xl bg-base-100 text-base-content"><DialogTitle>Discard contact changes?</DialogTitle><DialogDescription>Your changes have not been saved.</DialogDescription><div className="flex justify-end gap-2"><button type="button" className="du-btn du-btn-sm min-h-11" onClick={() => setConfirmDiscard(false)}>Keep editing</button><button type="button" className="du-btn du-btn-sm du-btn-primary min-h-11" onClick={() => { setConfirmDiscard(false); setEditor(null); setEditorDirty(false); }}>Discard changes</button></div></DialogContent></Dialog>
  </div>;
}
