import Link from "next/link";
import { ArrowRight, Calculator, FileText, Plus, Search } from "lucide-react";
import { ListingThumbnail } from "@/components/listings/ListingThumbnail";
import { appraisalStatuses, appraisalStatusLabel, type StrAppraisalRow } from "@/lib/str-appraisals/types";
import { appraisalPath, type WorkspaceAppraisalKind } from "@/lib/appraisals/workspaceTypes";
import type { AppraisalQuery } from "@/lib/str-appraisals/validation";

export type StrDashboardProps = {
  rows: StrAppraisalRow[];
  total: number;
  counts: Record<keyof typeof appraisalStatuses, number>;
  filters: AppraisalQuery;
  pageSize: number;
  propertyName?: string | null;
  kind?: WorkspaceAppraisalKind;
};
export function StrDashboard({ rows, total, counts, filters, pageSize, propertyName, kind = "str" }: StrDashboardProps) {
  const basePath = kind === "str" ? "/short-term-rentals" : `/appraisals/${kind === "lease" ? "rental" : "sales"}`;
  const copy = {
    str: { title: "Short-Term Rentals", description: "Prepare customer appraisals from your property library. Keep each conversation and its estimated gross STR revenue together.", create: "Compare rental potential, prepare a digital proposal and keep the customer’s details alongside the appraisal." },
    lease: { title: "Rental appraisals", description: "Prepare rental appraisals and digital proposals for your clients.", create: "Compare estimated weekly rent with local rental evidence, prepare a digital proposal and keep the customer’s details alongside the appraisal." },
    sales: { title: "Sales appraisals", description: "Prepare sales appraisals and digital proposals for your clients.", create: "Review comparable sales and an estimated selling range, prepare a digital proposal and keep the customer’s details alongside the appraisal." },
  }[kind];
  const newParams = new URLSearchParams({ ...(kind !== "str" ? { kind } : {}), ...(filters.listing_id ? { listing_id: filters.listing_id } : {}) });
  const newHref = `${kind === "str" ? "/short-term-rentals/appraisals/new" : "/appraisals/new"}${newParams.size ? `?${newParams}` : ""}`;
  function filterHref(values: Partial<AppraisalQuery>) {
    const params = new URLSearchParams();
    const next = { ...filters, ...values };
    if (next.q) params.set("q", next.q);
    if (next.status !== "all") params.set("status", next.status);
    if (next.listing_id) params.set("listing_id", next.listing_id);
    if (next.page > 1) params.set("page", String(next.page));
    return `${basePath}${params.size ? `?${params}` : ""}`;
  }
  return <div data-theme="staypack-workspace" className="space-y-7 text-base-content">
    <header><h1 className="font-display text-3xl sm:text-4xl">{copy.title}</h1><p className="mt-3 max-w-2xl text-base-content/65">{copy.description}</p></header>
    <div className={kind === "str" ? "grid gap-5 lg:grid-cols-[1.7fr_1fr]" : "grid gap-5"}>
      <section className="du-card border border-base-300 bg-base-100"><div className="du-card-body gap-4 p-6 sm:p-7"><h2 className="du-card-title font-display text-2xl">Create an appraisal for a client</h2><p className="max-w-lg text-sm leading-relaxed text-base-content/65">{copy.create}</p><div className="du-card-actions mt-2"><Link href={newHref} className="du-btn du-btn-sm du-btn-primary min-h-11"><Plus className="size-4" aria-hidden="true" />Create appraisal</Link></div></div></section>
      {kind === "str" && <section className="flex flex-col justify-center gap-3 rounded-2xl border border-dashed border-base-300 p-6 sm:p-7"><div className="flex items-center gap-3"><Calculator className="size-5" aria-hidden="true" /><h2 className="font-display text-xl">Calculator widget</h2></div><span className="du-badge du-badge-sm">Coming soon</span><p className="text-sm leading-relaxed text-base-content/65">Let property owners explore rental potential on your website, then turn their enquiry into a customer appraisal.</p></section>}
    </div>
    <div className="du-stats du-stats-horizontal w-full border-y border-base-300 bg-transparent" aria-label="Appraisal summary">
      {(["draft","ready","published"] as const).map((status) => <Link key={status} href={filterHref({ status, page:1 })} className="du-stat min-w-0 px-3 py-4 hover:bg-base-200 sm:px-4"><div className="du-stat-title">{appraisalStatuses[status].label}</div><div className="du-stat-value font-display text-3xl tabular-nums">{counts[status]}</div><div className="du-stat-desc hidden sm:block">View {status === "draft" ? "draft appraisals" : `${status} appraisals`}</div></Link>)}
    </div>
    {counts.failed > 0 && <Link className="flex items-center justify-between gap-3 rounded-xl bg-warning p-4 text-sm text-warning-content" href={filterHref({ status:"failed", page:1 })}><span>{counts.failed} appraisal{counts.failed === 1 ? " needs" : "s need"} attention</span><ArrowRight className="size-4" aria-hidden="true" /></Link>}
    <section className="space-y-5" aria-labelledby="appraisals-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="appraisals-title" className="font-display text-2xl">Appraisals</h2><p className="mt-1 text-sm text-base-content/65">{propertyName ? `For ${propertyName}` : "Across your agency’s properties"}</p></div>{(filters.q || filters.status !== "all" || filters.listing_id) && <Link href={basePath} className="du-btn du-btn-sm du-btn-ghost min-h-11">Clear filters</Link>}</div>
      <form action={basePath} method="get" className="flex flex-wrap items-end gap-3">
        {filters.listing_id && <input type="hidden" name="listing_id" value={filters.listing_id} />}
        <div className="min-w-0 flex-1 basis-60"><label htmlFor="appraisal-search" className="mb-2 block text-sm font-medium">Property or customer</label><div className="du-input du-input-sm min-h-11 w-full"><Search className="size-4" aria-hidden="true" /><input id="appraisal-search" name="q" type="search" defaultValue={filters.q} placeholder="Search appraisals" maxLength={160} /></div></div>
        <div className="min-w-44 flex-1 sm:flex-none"><label htmlFor="appraisal-status" className="mb-2 block text-sm font-medium">Status</label><select id="appraisal-status" name="status" defaultValue={filters.status} className="du-select du-select-sm min-h-11 w-full"><option value="all">All active</option>{Object.entries(appraisalStatuses).map(([value, group]) => <option key={value} value={value}>{group.label}</option>)}</select></div>
        <button type="submit" className="du-btn du-btn-sm min-h-11">Apply filters</button>
      </form>
      {rows.length === 0 ? <div className="rounded-xl border border-dashed border-base-300 p-8"><FileText className="mb-4 size-6 text-base-content/50" aria-hidden="true" /><h3 className="font-display text-xl">{filters.q || filters.status !== "all" || filters.page > 1 ? "No matching appraisals" : "Your first customer appraisal starts here"}</h3><p className="mt-2 max-w-lg text-sm text-base-content/65">{filters.q || filters.status !== "all" || filters.page > 1 ? "Try another search or clear the filters to see your appraisals." : "Choose a property from your library or import a new one. You can prepare several customer appraisals for the same property."}</p><Link href={filters.q || filters.status !== "all" || filters.page > 1 ? basePath : newHref} className="du-btn du-btn-sm mt-5 min-h-11">{filters.q || filters.status !== "all" || filters.page > 1 ? "View all appraisals" : "Create appraisal"}</Link></div> : <ul className="divide-y divide-base-300 border-y border-base-300">{rows.map((row) => <li key={row.report_id}><Link href={appraisalPath(row.report_id, kind)} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg py-5 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary sm:grid-cols-[auto_1fr_10rem_8rem_auto]">
        <ListingThumbnail src={row.report.listing.hero_image_url} address={row.report.listing.property_address || "Property"} className="size-16 sm:h-16 sm:w-24" />
        <div className="min-w-0"><h3 className="break-words font-medium">{row.report.listing.property_address || "Untitled property"}</h3><p className="mt-1 text-sm text-base-content/65">Prepared for {row.recipient_name || "general use"}</p>{row.report.listing.status === "archived" && <p className="mt-1 text-xs text-base-content/60">Property archived</p>}<span className="mt-2 inline-block text-xs sm:hidden">{row.proposal_status ?? appraisalStatusLabel(row.report.status)}</span></div>
        <div className="hidden sm:block"><span className="du-badge du-badge-sm">{row.proposal_status ?? appraisalStatusLabel(row.report.status)}</span>{(row.proposal_opens ?? 0) > 0 && <p className="mt-2 text-xs text-base-content/60">{row.proposal_opens} opens</p>}</div>
        <time className="hidden text-sm text-base-content/60 sm:block" dateTime={row.updated_at > row.report.updated_at ? row.updated_at : row.report.updated_at}>{new Date(row.updated_at > row.report.updated_at ? row.updated_at : row.report.updated_at).toLocaleDateString("en-AU", { day:"numeric",month:"short",year:"numeric",timeZone:"Australia/Sydney" })}</time>
        <ArrowRight className="mr-2 size-4" aria-hidden="true" />
      </Link></li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-base-content/65">{total} appraisal{total === 1 ? "" : "s"}{total > 0 ? ` · Page ${filters.page} of ${Math.ceil(total/pageSize)}` : ""}</p><div className="flex gap-2">{filters.page > 1 && <Link href={filterHref({ page:filters.page-1 })} className="du-btn du-btn-sm min-h-11">Previous</Link>}{filters.page*pageSize < total && <Link href={filterHref({ page:filters.page+1 })} className="du-btn du-btn-sm min-h-11">Next</Link>}</div></div>
    </section>
  </div>;
}
