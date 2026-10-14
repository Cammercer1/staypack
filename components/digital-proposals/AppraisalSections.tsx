"use client";
import Image from "next/image";
import type { ProposalData } from "@/lib/digital-proposals/data";
import { useProposalTracking } from "./ProposalTracking";
import { useProposalPageVisible } from "./PreparedProposalPage";
import { useEffect, useRef } from "react";
import { rentForPeriod } from "@/lib/property-market";
import { formatCurrency } from "@/lib/reports/formatters";
const appraisalMoney = (value: number | null, data: ProposalData, rent = false) => value === null ? "Not available" : formatCurrency(rent ? rentForPeriod(value, data.market) : value, data.market?.currency);
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
};
export function AppraisalSummary({ data }: { data: ProposalData }) {
  const appraisal = data.appraisal;
  if (!appraisal) return null;
  const lease = appraisal.kind === "lease";
  const period = data.market?.rentPeriod ?? "week";
  const money = (value: number | null) => appraisalMoney(value, data, lease);
  const range = appraisal.minimum !== null && appraisal.maximum !== null ? `${money(appraisal.minimum)} – ${money(appraisal.maximum)}` : money(appraisal.midpoint);
  const market = lease ? appraisal.market : null;
  return <section className="space-y-9 pb-8">
    <div className="max-w-4xl"><p className="mb-4 text-sm uppercase tracking-[0.16em] text-(--proposal-muted)">{lease ? "Rental appraisal" : "Sales appraisal"}</p><h1 tabIndex={-1} className="text-balance font-[family-name:var(--proposal-heading)] text-4xl leading-tight @min-[680px]/proposal:text-6xl">{lease ? "Your property's rental potential" : "A considered view of your property's value"}</h1></div>
    <div className="rounded-(--proposal-radius) bg-(--proposal-surface) p-6 @min-[680px]/proposal:p-10"><p className="text-sm text-(--proposal-muted)">{lease ? `Estimated ${period === "month" ? "monthly" : "weekly"} rental range` : "Estimated selling range"}</p><p className="mt-4 break-words font-[family-name:var(--proposal-heading)] text-[clamp(2rem,5cqi,4.5rem)] leading-tight text-(--proposal-primary)">{range}{lease && <span className="ml-2 text-xl">per {period}</span>}</p><p className="mt-5 max-w-3xl text-sm leading-relaxed">{lease ? "An estimate of gross rent before management fees and property costs. Achievable rent depends on property condition and market demand." : "An appraisal estimate based on the reviewed comparable evidence. The eventual selling price will depend on buyer demand, presentation and the sales process."}</p></div>
    {appraisal.summary && <p className="max-w-4xl whitespace-pre-line text-lg leading-relaxed">{appraisal.summary}</p>}
    {appraisal.highlights.length > 0 && <ul className="grid gap-4 @min-[680px]/proposal:grid-cols-2">{appraisal.highlights.map((item, index) => <li key={index} className="border-l-2 border-(--proposal-accent) pl-4 leading-relaxed">{item}</li>)}</ul>}
    {market && (market.medianWeeklyRent !== null || market.vacancyRate !== null || market.renterPercent !== null) && <div className="border-t border-current/15 pt-7"><h2 className="font-[family-name:var(--proposal-heading)] text-2xl">{market.suburb} rental market</h2><dl className="mt-5 flex flex-wrap gap-8">{market.medianWeeklyRent !== null && <div><dt className="text-sm text-(--proposal-muted)">Suburb median {period === "month" ? "monthly" : "weekly"} rent</dt><dd className="mt-2 text-2xl">{money(market.medianWeeklyRent)}</dd></div>}{market.vacancyRate !== null && <div><dt className="text-sm text-(--proposal-muted)">Vacancy rate</dt><dd className="mt-2 text-2xl">{market.vacancyRate}%</dd></div>}{market.renterPercent !== null && <div><dt className="text-sm text-(--proposal-muted)">Renter households</dt><dd className="mt-2 text-2xl">{market.renterPercent}%</dd></div>}</dl><p className="mt-4 text-xs text-(--proposal-muted)">Suburb context, separate from this property’s appraisal.{market.asOf ? ` Data as of ${dateLabel(market.asOf)}.` : ""}</p></div>}
    {appraisal.methodology && <p className="max-w-4xl whitespace-pre-line text-sm leading-relaxed text-(--proposal-muted)">{appraisal.methodology}</p>}
  </section>;
}
export function AppraisalComparables({ data }: { data: ProposalData }) {
  const track = useProposalTracking(); const visible = useProposalPageVisible(); const root = useRef<HTMLDivElement>(null);
  const comps = data.appraisal?.comparables;
  useEffect(() => {
    if (!visible || !root.current || !comps) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) track("comparable", entry.target.getAttribute("data-comp")!); }), { threshold: 0.4 });
    root.current.querySelectorAll("[data-comp]").forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [visible, track, comps]);
  if (!data.appraisal) return null;
  const period = data.market?.rentPeriod ?? "week";
  return <div ref={root} className="mt-8 space-y-6">
    <p className="max-w-4xl whitespace-pre-line leading-relaxed text-(--proposal-muted)">{data.appraisal.evidenceNote || (data.appraisal.kind === "sales" ? "Recent sales and current listings provide context for the estimated selling range. Asking prices are shown separately from sold results." : `These selected rental properties provide context for the estimated ${period === "month" ? "monthly" : "weekly"} range.`)}</p>
    <div className="grid gap-6 @min-[680px]/proposal:grid-cols-2 @min-[1100px]/proposal:grid-cols-3">{comps?.map((comp, index) => <article data-comp={index} key={comp.id} className="min-w-0 overflow-hidden rounded-(--proposal-radius) border border-current/15 bg-(--proposal-surface)">
      {comp.imageUrl && <Image unoptimized src={comp.imageUrl} alt={comp.name} width={640} height={420} className="aspect-[16/10] w-full object-cover" />}
      <div className="space-y-3 p-5"><p className="text-xs uppercase tracking-wider text-(--proposal-muted)">{comp.status === "sold" ? "Sold" : comp.status === "for_sale" ? "For sale · asking price" : "Rental listing"}</p><h2 className="text-lg font-semibold">{comp.name}</h2><p className="text-sm text-(--proposal-muted)">{[comp.bedrooms !== null ? `${comp.bedrooms} bedrooms` : "", comp.bathrooms !== null ? `${comp.bathrooms} bathrooms` : ""].filter(Boolean).join(" · ")}</p><p className="font-[family-name:var(--proposal-heading)] text-2xl">{comp.price !== null ? appraisalMoney(comp.price, data, comp.status === "rental") : comp.priceDisplay || "Price not disclosed"}{comp.status === "rental" && comp.price !== null ? ` / ${period}` : ""}</p>{comp.status === "sold" && comp.soldDate && <p className="text-xs text-(--proposal-muted)">Sold {dateLabel(comp.soldDate)}</p>}</div>
    </article>)}</div>
  </div>;
}
