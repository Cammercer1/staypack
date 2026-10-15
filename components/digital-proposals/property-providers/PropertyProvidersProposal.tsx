"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowRight, Bath, BedDouble, CarFront, ChevronLeft, ChevronRight, Download, List, Mail, Phone, Users, X } from "lucide-react";
import type { ProposalTemplateProps } from "../DigitalProposal";
import type { ProposalData } from "@/lib/digital-proposals/data";
import { monthlyRevenueProjection, occupancyMonthLabel } from "@/lib/digital-proposals/forecastPresentation";
import { proposalBrandStyle } from "@/lib/digital-proposals/brandStyle";
import { resolveTokenText } from "@/lib/digital-proposals/tokens";
import { ProposalFonts } from "../ProposalFonts";
import { ComparableListings } from "../ComparableListings";
import { comparablesByEstimate } from "@/lib/digital-proposals/presentation";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import styles from "./PropertyProvidersProposal.module.css";
import { PropertyProvidersService } from "./PropertyProvidersService";
import { useProposalChartMotion } from "../useProposalChartMotion";

const dollars = (value: number | null, currency: "AUD" | "USD" = "AUD") => value === null ? "—" : (currency === "USD" ? "US" : "") + new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const shortMoney = (value: number) => `$${Math.round(value / 1000)}k`;

function Features({ data }: { data: ProposalData }) {
  return <div className={styles.features}>{[
    { Icon: BedDouble, value: data.property.bedrooms, label: "beds" }, { Icon: Bath, value: data.property.bathrooms, label: "baths" },
    { Icon: CarFront, value: data.property.carSpaces, label: "parking" }, { Icon: Users, value: data.property.guests, label: "guests" },
  ].filter(item => item.value !== null).map(({ Icon, value, label }) => <span key={label}><Icon size={18} aria-hidden="true" />{value} {label}</span>)}</div>;
}

function ChartMotion({ motion, children }: { motion: boolean; children: React.ReactNode }) {
  const { ref, visible, animate } = useProposalChartMotion(motion);
  return <div ref={ref} className={styles.chartMotion} data-chart-motion={animate ? visible ? "playing" : "waiting" : "off"}>{children}</div>;
}

function Forecast({ data, motion, brand }: { data: ProposalData; motion: boolean; brand: ProposalTemplateProps["brand"] }) {
  const revenue = monthlyRevenueProjection(data);
  const months = data.occupancy?.months ?? [];
  const maxRevenue = Math.max(1000, ...revenue?.flatMap(row => [row.managed ?? 0, row.market ?? 0, row.ltr ?? 0]) ?? []);
  const ceiling = Math.ceil(maxRevenue / 5000) * 5000;
  const x = (i: number) => 46 + i * 39;
  const y = (v: number, max: number) => 200 - v / max * 156;
  return <>
    <div className={styles.forecastIntro}><h1 tabIndex={-1}>Revenue & occupancy</h1></div>
    <div className={styles.charts}>
      <section><div className={styles.chartHeading}><h2>Estimated monthly revenue</h2><span>{data.market?.currency ?? "AUD"} · before costs</span></div>
        {revenue ? <ChartMotion motion={motion}><svg viewBox="0 0 500 234" role="img" aria-label={`Estimated monthly gross revenue for long-term rent, the short-term market and ${data.agency.name} management`}>
          {Array.from({ length: ceiling / 5000 + 1 }, (_, i) => i * 5000).map(value => <g key={value}><line x1="40" x2="486" y1={y(value, ceiling)} y2={y(value, ceiling)} stroke="var(--pp-rule, #dbe5e8)" /><text x="32" y={y(value, ceiling) + 4} textAnchor="end">{shortMoney(value)}</text></g>)}
          <g className={styles.revenueReveal}>
          {(["ltr", "market", "managed"] as const).map(key => <path key={key} d={revenue.map((row, i) => row[key] === null ? "" : `${i === 0 || revenue[i - 1][key] === null ? "M" : "L"}${x(i)},${y(row[key]!, ceiling)}`).join(" ")} fill="none" stroke={key === "managed" ? brand.chartManaged : key === "market" ? brand.chartMarket : brand.chartLtr} strokeWidth={key === "managed" ? 3 : 2} strokeDasharray={key === "ltr" ? "5 4" : undefined} />)}
          {revenue.map((row, i) => <g key={row.month}>{row.managed !== null && <circle cx={x(i)} cy={y(row.managed, ceiling)} r="4" fill={brand.chartManaged}><title>{`${row.month}: ${dollars(row.managed, data.market?.currency)} estimated gross STR revenue`}</title></circle>}</g>)}
          </g>
          {revenue.map((row, i) => <text key={row.month} x={x(i)} y="221" textAnchor="middle">{row.month}</text>)}
        </svg><div className={styles.legend}><span><i style={{ background: brand.chartManaged }} />{data.agency.name}</span><span><i style={{ background: brand.chartMarket }} />STR market</span><span><i style={{ background: brand.chartLtr }} />Long-term rent</span></div></ChartMotion> : <p>Monthly revenue estimates are not available.</p>}
      </section>
      <section><div className={styles.chartHeading}><h2>Historical market occupancy</h2><span>{months.length ? `${occupancyMonthLabel(months[0].month)} – ${occupancyMonthLabel(months.at(-1)!.month)}` : ""}</span></div>
        {months.length ? <ChartMotion motion={motion}><svg viewBox="0 0 500 234" role="img" aria-label={`Historical monthly occupancy for ${data.occupancy?.label}`}>
          {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1="35" x2="491" y1={y(v, 100)} y2={y(v, 100)} stroke="var(--pp-rule, #dbe5e8)" /><text x="30" y={y(v, 100) + 4} textAnchor="end">{v}%</text></g>)}
          {months.map((row, i) => <g key={row.month}>{row.average !== null && <><rect className={styles.occupancyBar} style={{ animationDelay: `${120 + i * 40}ms` }} x={x(i) - 11} y={y(row.average, 100)} width="23" height={row.average / 100 * 156} fill={brand.chartManaged} rx="2"><title>{`${occupancyMonthLabel(row.month)}: ${Math.round(row.average)}%`}</title></rect><text className={styles.barValue} style={{ animationDelay: `${520 + i * 40}ms` }} x={x(i)} y={y(row.average, 100) - 7} textAnchor="middle">{Math.round(row.average)}%</text></>}<text x={x(i)} y="221" textAnchor="middle">{occupancyMonthLabel(row.month).slice(0,3)}</text></g>)}
        </svg><p className={styles.chartNote}>{data.occupancy?.label}. Historical market averages, not a forecast for this property.</p></ChartMotion> : <p>{data.occupancyNotice ?? "Monthly occupancy history is not available for this market."}</p>}
      </section>
    </div>
    <details className={styles.details}><summary>View figures & assumptions</summary><p>Estimated gross STR revenue excludes management fees and operating costs. Monthly estimates follow the saved seasonal pattern. Occupancy is an unweighted monthly market average; missing months are excluded. The operating plan must confirm owner use and permitted letting availability.</p>
      <div className={styles.tables}>{revenue && <table><caption>Estimated gross revenue ({data.market?.currency ?? "AUD"})</caption><thead><tr><th>Month</th><th>Long-term</th><th>STR market</th><th>Managed STR</th></tr></thead><tbody>{revenue.map(r=><tr key={r.month}><th>{r.month}</th><td>{dollars(r.ltr, data.market?.currency)}</td><td>{dollars(r.market, data.market?.currency)}</td><td>{dollars(r.managed, data.market?.currency)}</td></tr>)}</tbody></table>}{months.length > 0 && <table><caption>Historical market occupancy</caption><thead><tr><th>Month</th><th>Occupancy</th></tr></thead><tbody>{months.map(r=><tr key={r.month}><th>{occupancyMonthLabel(r.month)}</th><td>{r.average === null ? "Not available" : `${Math.round(r.average)}%`}</td></tr>)}</tbody></table>}</div>
    </details>
  </>;
}

function AgreementPreview({ data, brand }: { data: ProposalData; brand: ProposalTemplateProps["brand"] }) {
  return <Dialog><DialogTrigger className={styles.primaryButton}>Review & sign agreement <ArrowRight size={18} /></DialogTrigger>
    <DialogContent className={styles.agreement} style={proposalBrandStyle(brand)}>
      <DialogTitle className={styles.agreementTitle}>Property management agreement</DialogTitle>
      <DialogDescription>This is a demonstration of the agreement step. It is not a contract, and no signature or personal details will be collected.</DialogDescription>
      <div className={styles.agreementProperty}>{data.property.address}<small>{data.property.suburb}, {data.property.state} {data.property.postcode}</small></div>
      <ol><li><strong>Confirm your letting plan</strong><span>Availability, owner stays, furnishing and the recommended stay mix.</span></li><li><strong>Review the agreement</strong><span>Management services, fees, responsibilities and the agreed start date.</span></li><li><strong>Sign securely</strong><span>The final agreement is issued after the property and terms are confirmed.</span></li></ol>
      <div className={styles.signature}><span>Owner signature</span><span>Signature preview</span></div>
      <p className={styles.chartNote}>No agreement has been issued or accepted. This preview does not start onboarding.</p>
    </DialogContent>
  </Dialog>;
}

export function PropertyProvidersProposal({ data, brand, draft, initialPage, publicPath, exampleAgreement = false }: ProposalTemplateProps & { initialPage?: string; publicPath?: string; exampleAgreement?: boolean }) {
  const generic = draft.templateId === "agency-proposal";
  const pages = useMemo(() => draft.pages.filter(page => page.enabled), [draft.pages]);
  const [selected, setSelected] = useState(initialPage ?? pages[0]?.id);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [period, setPeriod] = useState<"annual" | "monthly">("annual");
  const root = useRef<HTMLDivElement>(null);
  const active = pages.find(page => page.id === selected) ?? pages[0];
  useEffect(() => {
    const restore = () => setSelected(new URLSearchParams(window.location.search).get("page") ?? pages[0]?.id);
    window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);
  }, [pages]);
  function navigate(id: string) {
    setContentsOpen(false);
    setSelected(id);
    if (publicPath) window.history.pushState(null, "", `${publicPath}?page=${encodeURIComponent(id)}`);
  }
  useEffect(() => {
    root.current?.scrollIntoView({ block: "start", behavior: "instant" });
    root.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [selected]);
  if (!active) return null;
  const index = pages.indexOf(active), cover = active.kind === "hero";
  const managed = data.str.managed.annualRevenue, ltr = data.ltr.annualRent;
  const rows = [{ label: "Long-term leasing", sub: "Estimated rental income", value: ltr, color: brand.chartLtr }, { label: "Short-term market", sub: "Estimated gross STR revenue", value: data.str.market.annualRevenue, color: brand.chartMarket }, { label: `With ${data.agency.name}`, sub: "Estimated gross STR revenue", value: managed, color: brand.chartManaged }];
  const max = Math.max(1, ...rows.map(row => row.value ?? 0));
  const control = (id: string, label: React.ReactNode, className?: string) => <a key={id} href={publicPath ? `${publicPath}?page=${encodeURIComponent(id)}` : `?page=${id}`} className={className} aria-current={id === active.id ? "page" : undefined} onClick={event => { if(event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(id); }}>{label}</a>;
  const navigationButton = "du-btn du-btn-sm du-btn-ghost min-h-11 min-w-11 rounded-(--proposal-radius) border-0 text-inherit shadow-none hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2";
  const paginationButton = cn(navigationButton, cover && "hover:bg-white/15");
  return <div data-theme={generic ? "agency-proposal" : "property-providers"} ref={root} className={`[--primary:var(--color-primary)] ${styles.proposal} ${cover ? styles.coverMode : ""} ${generic ? styles.agency : ""}`} style={proposalBrandStyle(brand)} data-testid="property-providers-proposal">
    <ProposalFonts brand={brand} />
    <header className={styles.header}>{control(pages[0].id, <Image src={data.agency.logoUrl} alt={data.agency.name} width={210} height={50} unoptimized priority className={styles.logo} />)}<span className={styles.liveBetter}>{draft.presentation?.tagline ?? (generic ? "" : "Live Better")}</span></header>
    {cover ? <section className={styles.cover}>
      <Image src={data.property.heroImageUrl} alt={data.property.address} fill unoptimized priority sizes="100vw" className={styles.coverImage} />
      <div className={styles.coverShade} /><div className={styles.coverContent}><h1 tabIndex={-1}>{data.property.address}</h1><p>{data.property.suburb}, {data.property.state} {data.property.postcode}</p><Features data={data} />{pages[1] && control(pages[1].id, <>View rental appraisal <ArrowRight size={20} /></>, styles.coverButton)}</div>
      <span className={styles.coverCaption}>{draft.presentation?.coverCaption ?? "Short stays · Extended stays · Flexible letting"}</span>
    </section> : <div className={styles.content} key={active.id}>
      {active.kind === "comparison" && <><div className={styles.intro}><h1 tabIndex={-1}>{resolveTokenText(draft.content.comparisonTitle, data).text}</h1><p>{data.property.address}, {data.property.suburb}</p></div>
        <div className={styles.appraisal}><aside className={styles.revenueCard}><span>With {data.agency.name}</span><strong>{dollars(managed, data.market?.currency)}</strong><p>Estimated annual gross STR revenue</p><div className={styles.revenueRule} />{managed !== null && ltr !== null && <><b>{dollars(managed - ltr, data.market?.currency)}</b><span>additional estimated annual revenue<br />compared with long-term leasing</span></>}<small>Before management fees & operating costs</small></aside>
          <section className={styles.comparison}><div className={styles.comparisonHeader}><h2>Compare your rental options</h2><div className={styles.toggle}>{(["annual", "monthly"] as const).map(value=><button key={value} onClick={()=>setPeriod(value)} aria-pressed={period===value}>{value === "annual" ? "Annual" : "Monthly"}</button>)}</div></div>
          <ChartMotion motion={draft.motion}>{rows.map((row, i)=><div className={styles.comparisonRow} key={row.label}><div><span>{row.label}</span><strong>{dollars(row.value === null ? null : row.value / (period === "monthly" ? 12 : 1), data.market?.currency)}</strong></div><div className={styles.barTrack}><div className={styles.comparisonBar} style={{width:`${(row.value ?? 0)/max*100}%`,background:row.color,animationDelay:`${120 + i * 90}ms`}} /></div><small>{row.sub}</small></div>)}</ChartMotion><p className={styles.chartNote}>Estimates are before fees and costs. Your letting plan will be tailored to property readiness, permitted use and owner availability.</p></section>
        </div></>}
      {active.kind === "forecast" && <Forecast data={data} motion={draft.motion} brand={brand} />}
      {active.kind === "evidence" && <><div className={styles.intro}><h1 tabIndex={-1}>Comparable rentals</h1><p>Nearby short-term rentals used to inform the estimate.</p></div><ComparableListings currency={data.market?.currency} comparables={comparablesByEstimate(data)} motion={draft.motion} maxVisible={3} className={cn(styles.comparables, "mt-0")} renderComparable={(comp, i) => <article className="h-full"><div className={styles.compImage}>{comp.imageUrl && <Image src={comp.imageUrl} alt={comp.name} fill unoptimized loading={i === 0 ? "eager" : "lazy"} sizes="(max-width: 760px) 85vw, 33vw" />}<span>{comp.distanceM === null ? "Nearby property" : `${(comp.distanceM/1000).toFixed(1)} km away`}</span></div><div className={styles.compBody}><h2>{comp.name}</h2><span>{comp.bedrooms ?? "—"} bedrooms</span><strong>{dollars(comp.annualRevenue, data.market?.currency)}<small>Estimated annual gross STR revenue</small></strong></div></article>} /><p className={styles.chartNote}>Comparable properties differ in location, presentation, amenities and availability. Their estimates do not guarantee the performance of this property.</p></>}
      {active.kind === "service" && active.service && <PropertyProvidersService service={active.service} theme={generic ? "agency-proposal" : "property-providers"} />}
      {active.kind === "text" && <><h1 tabIndex={-1}>{active.title}</h1><p>{active.body}</p></>}
      {active.kind === "next_steps" && <><div className={styles.nextSteps}><div><h1 tabIndex={-1}>Let’s get started</h1><p>Contact our team to discuss the letting plan for {data.property.address}.</p><ol className={styles.steps}><li><b>01</b><span><strong>Make a plan</strong>Confirm your goals, availability and property presentation.</span></li><li><b>02</b><span><strong>Review the agreement</strong>Review the management agreement and service details.</span></li><li><b>03</b><span><strong>Welcome your first guests</strong>Prepare the property, launch the listing and manage each stay.</span></li></ol>{exampleAgreement ? <><AgreementPreview data={data} brand={brand} /><div className="mt-4"><button type="button" className="inline-flex min-h-11 items-center justify-center gap-3 rounded-sm border border-current/20 bg-transparent px-5 py-3 text-sm max-[760px]:w-full"><Download size={18} aria-hidden="true" />Download proposal PDF</button></div></> : draft.links.map(link=><a key={link.id} href={link.url} className={styles.primaryButton}>{link.label}<ArrowRight size={18} /></a>)}</div>
        <aside className={styles.contactCard}>{data.agents.map(agent=><div key={agent.email}><div className={styles.agentPhoto}>{agent.photoUrl && <Image src={agent.photoUrl} alt={agent.name} fill unoptimized sizes="(max-width: 700px) 100vw, 340px" />}</div><div className={styles.agentDetails}><h2>{agent.name}</h2><p>{agent.role}</p>{agent.phone && <a href={`tel:${agent.phone.replace(/[^+\d]/g,"")}`}><Phone size={15} />{agent.phone}</a>}{agent.email && <a href={`mailto:${agent.email}`}><Mail size={15} />{agent.email}</a>}</div></div>)}</aside></div><details className={styles.disclaimer}><summary>Important information about these estimates <ArrowDown size={14} /></summary><p>{data.disclaimer}</p></details></>}
    </div>}
    <nav aria-label="Proposal pagination" className={cn("fixed inset-x-0 bottom-0 z-20 grid min-h-[76px] grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-base-300 bg-base-100 px-[clamp(1rem,4vw,4rem)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm text-base-content", cover && "border-white/15 bg-neutral/90 text-neutral-content backdrop-blur-md")}>
      <div className="justify-self-start">{index > 0 && control(pages[index - 1].id, <><ChevronLeft size={18} aria-hidden="true" /><span className="sr-only min-[480px]:not-sr-only">Previous</span></>, paginationButton)}</div>
      <Dialog open={contentsOpen} onOpenChange={setContentsOpen}>
        <DialogTrigger className={paginationButton} aria-label="Open table of contents">
          <List size={17} aria-hidden="true" /><span>Contents</span><span aria-hidden="true" className="ml-2 font-normal tabular-nums opacity-65">{index + 1} / {pages.length}</span>
        </DialogTrigger>
        <DialogContent data-theme={generic ? "agency-proposal" : "property-providers"} style={proposalBrandStyle(brand)} showCloseButton={false} className="[--primary:var(--color-primary)] inset-x-0 top-auto bottom-0 flex max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl bg-base-100 p-0 font-[family-name:var(--proposal-body)] text-base-content sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-3rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-base-300 px-6 py-5">
            <div className="min-w-0">
              <DialogTitle className="font-[family-name:var(--proposal-heading)] text-2xl leading-tight">Contents</DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-relaxed text-base-content/65 [overflow-wrap:anywhere]">{data.property.address}</DialogDescription>
            </div>
            <DialogClose aria-label="Close contents" className={cn(navigationButton, "shrink-0")}><X size={20} aria-hidden="true" /></DialogClose>
          </div>
          <nav aria-label="Proposal pages" className="min-h-0 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <ul className="du-menu w-full gap-1 p-0">
              {pages.map((page, i) => <li key={page.id}>{control(page.id, <>
                <span className="tabular-nums opacity-65">{String(i + 1).padStart(2, "0")}</span>{" "}
                <span className="min-w-0 [overflow-wrap:anywhere]">{resolveTokenText(page.title, data).text}</span>
                {page.id === active.id && <span aria-hidden="true" className="text-xs font-normal">Current</span>}
              </>, cn("min-h-14 rounded-(--proposal-radius) text-sm focus-visible:outline-2 focus-visible:outline-offset-2", page.id === active.id ? "bg-primary font-medium text-primary-content" : "hover:bg-base-200"))}</li>)}
            </ul>
          </nav>
        </DialogContent>
      </Dialog>
      <div className="justify-self-end">{index < pages.length - 1 && control(pages[index + 1].id, <><span className="sr-only min-[480px]:not-sr-only">Next</span><ChevronRight size={18} aria-hidden="true" /></>, paginationButton)}</div>
      <span aria-live="polite" className="sr-only">Page {index + 1} of {pages.length}: {resolveTokenText(active.title, data).text}</span>
    </nav>
  </div>;
}
