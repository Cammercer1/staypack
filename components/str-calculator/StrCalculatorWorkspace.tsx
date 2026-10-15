"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, Code2, Copy, ExternalLink, FilePlus2, Globe, LoaderCircle, Mail, Phone, RefreshCw, RotateCcw, Users } from "lucide-react";
import { StrCalculatorWidget } from "./StrCalculatorWidget";
import type { CalculatorBrand } from "@/lib/str-calculator/brand";
import { calculatorMoney, type CalculatorLead, type CalculatorSettings } from "@/lib/str-calculator/schema";
import { cn } from "@/lib/utils";
import { strAppraisalPath } from "@/lib/str-appraisals/types";

type Props = {
  brand: CalculatorBrand; initialWidget: CalculatorSettings | null; canManage: boolean;
  leads: CalculatorLead[]; total: number; page: number; baseUrl: string; loadedAt: number;
};

export function StrCalculatorWorkspace({ brand, initialWidget, canManage, leads, total, page, baseUrl, loadedAt }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "setup" ? "setup" : "leads";
  const leadsHref = page > 1 ? `${pathname}?page=${page}` : pathname;
  const setupHref = `${pathname}?tab=setup${page > 1 ? `&page=${page}` : ""}`;
  const [widget, setWidget] = useState(initialWidget);
  const [country, setCountry] = useState<"AU" | "US">(initialWidget?.country ?? "AU");
  const [askPhone, setAskPhone] = useState(initialWidget?.ask_phone ?? false);
  const [previewKey, setPreviewKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creatingLead, setCreatingLead] = useState<string | null>(null);
  const [reportError, setReportError] = useState("");
  const [createdReports, setCreatedReports] = useState<Record<string, string>>({});
  const settingsChanged = country !== (widget?.country ?? "AU") || askPhone !== (widget?.ask_phone ?? false);
  const embedUrl = widget ? `${baseUrl}/embed/str-calculator/${widget.public_token}` : "";
  const code = embedUrl ? `<iframe\n  src="${embedUrl}"\n  title="Short-term rental revenue calculator"\n  width="100%"\n  height="900"\n  style="border:0; border-radius:16px;"\n  loading="lazy"\n></iframe>` : "";

  async function save(enabled: boolean) {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/marketing/str-calculator", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, country, ask_phone: askPhone }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t save the calculator.");
      setWidget(result.widget); setMessage(enabled ? "Settings saved. Your calculator is active." : "Settings saved. Your calculator is paused."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t save the calculator."); }
    finally { setSaving(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(code); setMessage("Embed code copied."); setError(""); }
    catch { setError("Copy isn’t available in this browser. Select and copy the code below."); }
  }

  async function createReport(lead: CalculatorLead) {
    if (creatingLead) return;
    setCreatingLead(lead.id); setReportError("");
    try {
      const response = await fetch(`/api/marketing/str-calculator/leads/${lead.id}/report`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || typeof result.report_id !== "string") throw new Error(result.error || "Couldn’t create the report. Please try again.");
      setCreatedReports(previous => ({ ...previous, [lead.id]: result.report_id }));
      if (Array.isArray(result.warnings) && result.warnings.length) {
        setReportError(result.warnings.join(" ") + " Use Open report to continue.");
        router.refresh();
      } else { router.push(strAppraisalPath(result.report_id)); router.refresh(); }
    } catch (cause) { setReportError(cause instanceof Error ? cause.message : "Couldn’t create the report. Please try again."); }
    finally { setCreatingLead(null); }
  }

  return <div data-theme="staypack-workspace" className="min-w-0 space-y-9 text-base-content">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="font-display text-4xl tracking-tight">STR calculator</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-base-content/70">Manage your website enquiries and the calculator that brings them in.</p></div>
      <span className={widget?.enabled ? "du-badge du-badge-outline du-badge-success mt-2" : "du-badge du-badge-outline mt-2"}>{widget?.enabled ? "Active" : "Not active"}</span>
    </header>

    <nav aria-label="STR calculator views" className="du-tabs du-tabs-border flex-nowrap border-b border-base-300">
      <Link href={leadsHref} scroll={false} aria-current={tab === "leads" ? "page" : undefined} className={cn("du-tab min-h-12 gap-2 px-3 text-sm sm:px-5", tab === "leads" && "du-tab-active font-semibold")}><Users className="hidden size-4 sm:block" aria-hidden="true" />Leads <span className="du-badge du-badge-sm tabular-nums">{total}</span></Link>
      <Link href={setupHref} scroll={false} aria-current={tab === "setup" ? "page" : undefined} className={cn("du-tab min-h-12 gap-2 px-3 text-sm sm:px-5", tab === "setup" && "du-tab-active font-semibold")}><Code2 className="hidden size-4 sm:block" aria-hidden="true" />Embed &amp; settings</Link>
    </nav>

    {tab === "setup" ? <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.85fr)]">
      <section aria-labelledby="calculator-preview-heading" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="calculator-preview-heading" className="text-lg font-semibold">Your calculator</h2><Link href="/settings/brand" className="text-sm underline underline-offset-4">Edit brand settings</Link></div>
        <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm [&>section]:rounded-2xl"><StrCalculatorWidget key={`${country}-${askPhone}-${previewKey}`} brand={brand} country={country} askPhone={askPhone} preview /></div>
        <div className="mt-3 flex justify-center"><button type="button" onClick={() => setPreviewKey(value => value + 1)} className="du-btn du-btn-sm du-btn-ghost min-h-11 text-base-content/70"><RotateCcw className="size-4" aria-hidden="true" />Restart</button></div>
      </section>

      <section aria-labelledby="embed-heading" className="min-w-0 space-y-6">
        <div><h2 id="embed-heading" className="flex items-center gap-2 text-lg font-semibold"><Code2 className="size-5" aria-hidden="true" />Add it to your website</h2><p className="mt-2 text-sm leading-6 text-base-content/70">Your colours and fonts come straight from Brand settings. Updates appear automatically.</p></div>
        <div className="du-card du-card-border bg-base-100"><div className="du-card-body gap-4 p-5">
          <label htmlFor="calculator-country" className="flex items-center gap-2 text-sm font-medium"><Globe className="size-4" aria-hidden="true" />Property market</label>
          <select id="calculator-country" value={country} onChange={event => setCountry(event.target.value as "AU" | "US")} disabled={!canManage || saving} className="du-select w-full"><option value="AU">Australia · AUD</option><option value="US">United States · USD</option></select>
          <label className="flex min-h-11 items-center justify-between gap-4 text-sm font-medium"><span>Ask for phone number</span><input type="checkbox" role="switch" checked={askPhone} onChange={event => setAskPhone(event.target.checked)} disabled={!canManage || saving} aria-describedby="calculator-phone-help" className="du-toggle du-toggle-sm shrink-0" /></label>
          <p id="calculator-phone-help" className="-mt-2 text-xs leading-5 text-base-content/70">Adds an optional phone field to Your details.</p>
          <p className="text-xs leading-5 text-base-content/70">Visitors enter their property and contact details. They see the estimate immediately; their enquiry appears in Leads.</p>
          {canManage ? <div className="flex flex-wrap gap-2">
            {settingsChanged && <button type="button" disabled={saving} onClick={() => void save(Boolean(widget?.enabled))} className="du-btn du-btn-primary min-h-11">{saving && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}Save settings</button>}
            <button type="button" disabled={saving} onClick={() => void save(!widget?.enabled)} className={settingsChanged ? "du-btn du-btn-ghost min-h-11" : "du-btn du-btn-primary min-h-11"}>{saving && !settingsChanged && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}{widget?.enabled ? "Pause calculator" : "Activate calculator"}</button>
          </div> : <p className="text-sm text-base-content/70">An agency admin can activate or pause the calculator.</p>}
          <p className="text-xs leading-5 text-base-content/70">Live requests use the standard estimate service. Limits: 100 enquiries per day and 5 per visitor per hour.</p>
        </div></div>

        {widget && <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="calculator-embed-code" className="text-sm font-semibold">Embed code</label><button type="button" onClick={() => void copy()} className="du-btn du-btn-sm du-btn-ghost min-h-10"><Copy className="size-4" aria-hidden="true" />Copy code</button></div>
          <textarea id="calculator-embed-code" readOnly value={code} rows={9} spellCheck={false} className="du-textarea w-full resize-y bg-base-100 font-mono text-xs leading-5" onFocus={event => event.target.select()} />
          <p className="text-xs leading-5 text-base-content/70">Paste this into an HTML or embed block on your website. It fills the available width. The frame scrolls on smaller screens.</p>
          {widget.enabled && <a href={embedUrl} target="_blank" rel="noreferrer" className="du-btn du-btn-sm du-btn-ghost min-h-11 px-0"><ExternalLink className="size-4" aria-hidden="true" />Open live calculator</a>}
        </div>}
        {message && <p role="status" className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{message}</p>}
        {error && <p role="alert" className="du-alert du-alert-error text-sm">{error}</p>}
        <div className="border-t border-base-300 pt-5"><h3 className="text-sm font-semibold">Try the journey</h3><p className="mt-2 text-sm leading-6 text-base-content/70">Use the preview to walk through all three steps. Its sample result is for demonstration only, and won’t appear in your leads.</p></div>
      </section>
    </div> :

    <section aria-labelledby="calculator-leads-heading" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 id="calculator-leads-heading" className="text-xl font-semibold">Calculator leads</h2><p className="mt-2 text-sm text-base-content/70">Property enquiries captured by your live calculator, newest first.</p></div><button type="button" onClick={() => router.refresh()} className="du-btn du-btn-sm du-btn-ghost min-h-11"><RefreshCw className="size-4" aria-hidden="true" />Refresh leads</button></div>
      {reportError && <p role="alert" className="du-alert du-alert-error mb-4 text-sm">{reportError}</p>}
      {leads.length ? <div className="max-w-full overflow-x-auto rounded-xl border border-base-300 bg-base-100">
        <table className="du-table du-table-sm max-sm:block"><caption className="sr-only">Enquiries from your agency’s STR calculator</caption><thead className="max-sm:sr-only"><tr><th scope="col">Property</th><th scope="col">Contact</th><th scope="col">Estimated gross STR revenue</th><th scope="col">Received</th><th scope="col"><span className="sr-only">Report</span></th></tr></thead>
          <tbody className="max-sm:block">{leads.map(lead => <tr key={lead.id} className="hover:bg-base-200/40 max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-2 max-sm:p-3">
            <td className="min-w-48 whitespace-normal py-5 sm:max-w-72 max-sm:col-span-2 max-sm:block max-sm:py-2"><p className="font-medium">{lead.address}</p><p className="mt-1 text-xs text-base-content/70">{lead.bedrooms === 0 ? "Studio" : `${lead.bedrooms} bedrooms`} · {lead.country}</p></td>
            <td className="max-sm:col-span-2 max-sm:block max-sm:pb-3"><div className="flex flex-col items-start gap-2"><a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 break-all underline underline-offset-4"><Mail className="size-3.5 shrink-0" aria-hidden="true" />{lead.email}</a>{lead.phone && <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 underline underline-offset-4"><Phone className="size-3.5 shrink-0" aria-hidden="true" />{lead.phone}</a>}</div></td>
            <td className="max-sm:block"><span className="mb-1 block text-xs text-base-content/70 sm:hidden">Estimated gross STR revenue</span>{lead.estimate_json ? <><p className="font-medium tabular-nums">{calculatorMoney(lead.estimate_json.annualRevenue, lead.estimate_json.currency)} {lead.estimate_json.currency} / year</p><span className="mt-1 inline-block text-xs text-base-content/70">Estimate delivered</span></> : <span className="du-badge du-badge-sm du-badge-outline">{lead.status === "failed" || loadedAt - Date.parse(lead.created_at) > 120000 ? "Needs follow-up" : "Preparing estimate"}</span>}</td>
            <td className="text-xs sm:whitespace-nowrap max-sm:block"><span className="mb-1 block text-base-content/70 sm:hidden">Received</span><time dateTime={lead.created_at}>{new Date(lead.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Sydney" })}</time><p className="mt-1 text-base-content/70">Sydney time</p></td>
            <td className="whitespace-nowrap max-sm:col-span-2 max-sm:block max-sm:pt-3">{(lead.report_id || createdReports[lead.id]) ? <Link href={strAppraisalPath(lead.report_id || createdReports[lead.id])} className="du-btn du-btn-sm du-btn-outline min-h-11 max-sm:w-full">Open report<ExternalLink className="size-4" aria-hidden="true" /></Link> : <button type="button" onClick={() => void createReport(lead)} disabled={creatingLead !== null || (lead.status === "processing" && loadedAt - Date.parse(lead.created_at) <= 120000)} aria-label={`Create report for ${lead.address}`} className="du-btn du-btn-sm du-btn-outline min-h-11 max-sm:w-full">{creatingLead === lead.id ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FilePlus2 className="size-4" aria-hidden="true" />}{creatingLead === lead.id ? "Creating…" : "Create report"}</button>}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-base-300 p-8"><Mail className="size-6 text-base-content/60" aria-hidden="true" /><h3 className="text-lg font-medium">Your next property conversation starts here.</h3><p className="max-w-xl text-sm leading-6 text-base-content/70">{total ? "There are no enquiries on this page. Return to the first page to see your latest leads." : "Once a visitor submits your live calculator, their property, contact details and estimate will appear here. Add the calculator to your website to get started."}</p><Link href={total ? pathname : setupHref} className="du-btn du-btn-sm min-h-11">{total ? "View latest leads" : "Set up your calculator"}</Link></div>}
      {total > 25 && <nav aria-label="Lead pages" className="mt-4 flex items-center justify-between gap-4 text-sm"><span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span><div className="flex gap-2">{page > 1 && <Link className="du-btn du-btn-sm min-h-10" href={`${pathname}?page=${page - 1}`}>Previous</Link>}{page * 25 < total && <Link className="du-btn du-btn-sm min-h-10" href={`${pathname}?page=${page + 1}`}>Next</Link>}</div></nav>}
    </section>}
  </div>;
}
