"use client";

import { AppraisalSummary, AppraisalComparables } from "./AppraisalSections";
import { memo, type ComponentType } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Bath, BedDouble, CarFront, Download, Users } from "lucide-react";
import { comparablesByEstimate } from "@/lib/digital-proposals/presentation";
import { type ProposalData } from "@/lib/digital-proposals/data";
import { proposalBrandStyle } from "@/lib/digital-proposals/brandStyle";
import type { ProposalBrand } from "@/lib/digital-proposals/brand";
import { resolveTokenText } from "@/lib/digital-proposals/tokens";
import { type ProposalDraft, type ProposalPage } from "@/lib/digital-proposals/template";
import type { ProposalAttachmentLink } from "@/lib/digital-proposals/workspace";
import { isSafeProposalUrl } from "@/lib/digital-proposals/links";
import { ProposalAgentContacts } from "./ProposalAgentContacts";
import { agencyContactActions, hasAgentContact } from "@/lib/digital-proposals/contacts";
import { useProposalTracking } from "./ProposalTracking";
import { ProposalFonts } from "./ProposalFonts";

// Only the displayed section is rendered; these same modules are warmed after the cover paints.
const ProposalComparison = dynamic(() => import("./ProposalComparison").then(m => m.ProposalComparison), { loading: ProposalSectionLoading });
const YearlyForecast = dynamic(() => import("./YearlyForecast").then(m => m.YearlyForecast), { loading: ProposalSectionLoading });
const ComparableListings = dynamic(() => import("./ComparableListings").then(m => m.ComparableListings), { loading: ProposalSectionLoading });
const ProposalManagementService = dynamic(() => import("./ProposalManagementService").then(m => m.ProposalManagementService), { loading: ProposalSectionLoading });
function ProposalSectionLoading() {
  return <div data-proposal-loading role="status" className="min-h-64"><span className="sr-only">Preparing proposal page</span></div>;
}

export type ProposalTemplateProps = { data: ProposalData; brand: ProposalBrand; draft: ProposalDraft; fullViewport?: boolean };
export type DigitalTemplateDefinition = {
  id: string; version: number; Component: ComponentType<ProposalTemplateProps>;
};
type ProposalSections = { hero: ComponentType<ProposalTemplateProps>; comparison: ComponentType<ProposalTemplateProps> };

export function ProposalHero({ data, draft, fullViewport = false }: ProposalTemplateProps) {
  const resolve = (value: string) => resolveTokenText(value, data).text;
  const recipient = resolve(draft.content.recipientLine);
  const subtitle = [resolve(draft.content.introduction), recipient].filter(Boolean).join(" ");
  const locality = [data.property.suburb, data.property.state, data.property.postcode].filter(Boolean).join(" ");
  const panorama = draft.heroLayout === "panorama";
  const features = [
    { Icon: BedDouble, value: data.property.bedrooms, label: "bedroom" },
    { Icon: Bath, value: data.property.bathrooms, label: "bathroom" },
    { Icon: CarFront, value: data.property.carSpaces, label: "car space" },
    { Icon: Users, value: data.appraisal ? null : data.property.guests, label: "guest" },
  ].filter(item => item.value !== null).map(({ Icon, value, label }) => <span key={label} className="inline-flex items-center gap-2"><Icon size={18} aria-hidden="true" /><span>{value} <span className="sr-only">{label}{value === 1 ? "" : "s"}</span></span></span>);

  if (draft.heroLayout === "overlay") return <section aria-label="Property introduction" className={cn("du-hero relative isolate overflow-hidden bg-slate-950 text-white", fullViewport ? "min-h-dvh w-full" : "-mx-5 mb-10 min-h-[34rem] w-auto @min-[600px]/proposal:-mx-10 @min-[680px]/proposal:mb-16 @min-[680px]/proposal:min-h-[40rem] @min-[900px]/proposal:-mx-14")}>
    {data.property.heroImageUrl && <Image unoptimized loading="eager" fetchPriority="high" data-proposal-critical-image src={data.property.heroImageUrl} alt={data.property.address} fill sizes="100vw" className="object-cover" />}
    <div aria-hidden="true" className={cn("du-hero-overlay absolute inset-0 z-1 bg-transparent bg-linear-to-t", fullViewport ? "from-black/90 via-black/35 via-55% to-black/40" : "from-black/90 via-black/60 via-60% to-black/10")} />
    <div className={cn("du-hero-content relative z-10 w-full min-w-0 max-w-none self-end text-center", fullViewport ? "px-[clamp(1.5rem,6vw,6rem)] pt-44 pb-[calc(clamp(8rem,16dvh,11rem)+env(safe-area-inset-bottom))]" : "px-6 pt-48 pb-10 @min-[600px]/proposal:px-12 @min-[680px]/proposal:pb-16", draft.motion && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700")}>
      <div className={cn("w-full [overflow-wrap:anywhere]", fullViewport ? "max-w-7xl" : "max-w-3xl")}>
        <h1 tabIndex={-1} className={cn("mx-auto text-balance font-[family-name:var(--proposal-heading)] leading-[1.08] tracking-tight", fullViewport ? "max-w-6xl text-[clamp(2.75rem,6.5cqi,7rem)]" : "max-w-2xl text-[clamp(2.25rem,5.5cqi,4.5rem)]")}>{resolve(draft.content.title)}</h1>
        {locality && <p className="mt-3 text-base">{locality}</p>}
        {subtitle && <p className={cn("mx-auto mt-5 max-w-2xl whitespace-pre-line text-pretty leading-relaxed", fullViewport && "text-base @min-[680px]/proposal:text-xl")}>{subtitle}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm" aria-label="Property features">{features}</div>
      </div>
    </div>
  </section>;

  return <section aria-label="Property introduction" className="pb-10 @min-[680px]/proposal:pb-16">
    <div className={cn("grid gap-8", !panorama && "@min-[680px]/proposal:grid-cols-[0.95fr_1.05fr] @min-[680px]/proposal:items-center @min-[680px]/proposal:gap-12")}>
      <div className={draft.motion ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700" : ""}>
        <h1 tabIndex={-1} className="max-w-3xl font-[family-name:var(--proposal-heading)] text-[clamp(2.25rem,5.5cqi,4.5rem)] leading-[1.08] tracking-tight [overflow-wrap:anywhere]">{resolve(draft.content.title)}</h1>
        {locality && <p className="mt-3 text-sm text-(--proposal-muted)">{locality}</p>}
        {subtitle && <p className="mt-4 max-w-xl whitespace-pre-line leading-relaxed text-(--proposal-muted)">{subtitle}</p>}
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm" aria-label="Property features">
          {features}
        </div>
      </div>
      <figure className="min-w-0">
        {data.property.heroImageUrl ? <Image unoptimized loading="eager" fetchPriority="high" data-proposal-critical-image src={data.property.heroImageUrl} alt={data.property.address} width={1200} height={900} className={cn("w-full rounded-(--proposal-radius) object-cover", panorama ? "aspect-[2/1]" : "aspect-[5/4] @min-[680px]/proposal:aspect-[4/5]")} />
          : <div className="flex aspect-[5/4] items-center justify-center rounded-(--proposal-radius) bg-(--proposal-surface) text-(--proposal-muted)">Property photography to come</div>}
        <figcaption className="mt-3 text-sm text-(--proposal-muted)">{data.property.address}</figcaption>
      </figure>
    </div>
  </section>;
}

/** Custom accounts can replace either section or register an entirely different Component. */
export const DigitalProposal = memo(function DigitalProposal({ data, brand, draft, sections, page, attachments = [], showDisclaimer = true, previewPdfDownload = false, pdfHref, fullViewport = false }: ProposalTemplateProps & { sections?: Partial<ProposalSections>; page?: ProposalPage; attachments?: ProposalAttachmentLink[]; showDisclaimer?: boolean; previewPdfDownload?: boolean; pdfHref?: string }) {
  const track = useProposalTracking();
  const Hero = sections?.hero ?? ProposalHero;
  const Comparison = sections?.comparison ?? ProposalComparison;
  const coverOnly = page?.kind === "hero" && draft.heroLayout === "overlay" && !page.body && !showDisclaimer;
  const immersiveCover = fullViewport && coverOnly;
  const agencyActions = hasAgentContact(data.agents) ? [] : agencyContactActions(data.agency);
  return <article data-testid="digital-proposal" style={proposalBrandStyle(brand)} className={cn("@container/proposal min-w-0 bg-(--proposal-bg) font-[family-name:var(--proposal-body)] text-(--proposal-text)", fullViewport && "relative flex-1")}>
    <ProposalFonts brand={brand} />
    <div className={cn(immersiveCover ? "relative" : fullViewport ? "mx-auto w-full max-w-[100rem] px-[clamp(1.25rem,5vw,5rem)] pt-[clamp(1.5rem,4vh,3rem)] pb-12" : "px-5 pt-6 @min-[600px]/proposal:px-10 @min-[900px]/proposal:px-14", coverOnly ? "[&>section]:mb-0" : !fullViewport && "pb-8")}>
      <header className={cn("flex flex-wrap items-center justify-between gap-3", immersiveCover ? "absolute inset-x-0 top-0 z-20 px-[clamp(1.5rem,5vw,5rem)] pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 text-white @min-[680px]/proposal:pt-8" : "pb-5", (draft.heroLayout !== "overlay" || (page && page.kind !== "hero")) && "mb-10 border-b border-current/15")}>
        {data.agency.logoUrl ? <Image unoptimized loading="eager" data-proposal-critical-image src={data.agency.logoUrl} alt={data.agency.name} width={160} height={48} className={cn("h-10 max-w-44 object-contain", immersiveCover && "brightness-0 invert")} /> : <span className="font-[family-name:var(--proposal-heading)] text-xl font-semibold">{data.agency.name}</span>}
        <span className={cn("text-xs", immersiveCover ? "text-white/80" : "text-(--proposal-muted)")}>{data.appraisal?.kind === "sales" ? "Sales appraisal" : "Rental appraisal"} · {new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "Australia/Sydney" }).format(new Date(data.generatedAt))}</span>
      </header>
      {(!page || page.kind === "hero") && <Hero fullViewport={immersiveCover} data={data} brand={brand} draft={draft} />}
      {(!page || page.kind === "comparison") && (data.appraisal ? <AppraisalSummary data={data} /> : <Comparison key={draft.initialComparisonMode} data={data} brand={brand} draft={draft} />)}
      {page?.kind === "service" && page.service && <ProposalManagementService service={page.service} data={data} motion={draft.motion} />}
      {page && !["hero", "comparison", "service"].includes(page.kind) && <section data-proposal-evidence={page.kind === "evidence" || undefined} className="min-h-80">
        <h1 tabIndex={-1} className="text-balance font-[family-name:var(--proposal-heading)] text-3xl leading-tight @min-[600px]/proposal:text-5xl">{resolveTokenText(page.title, data).text}</h1>
        {page.body && <p className="mt-6 max-w-3xl whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">{resolveTokenText(page.body, data).text}</p>}
        {page.kind === "forecast" && <YearlyForecast data={data} brand={brand} motion={draft.motion} />}
        {page.kind === "evidence" && (data.appraisal ? <AppraisalComparables data={data} /> : <ComparableListings comparables={comparablesByEstimate(data)} motion={draft.motion} />)}
        {page.kind === "next_steps" && <div className="mt-8 space-y-8">
          {attachments.length > 0 && <div><h2 className="mb-3 text-lg font-semibold">Documents</h2><ul className="divide-y divide-current/15">{attachments.map(item => <li key={item.id}><a download={item.name} href={item.href} onClick={() => track("document", item.id)} className="flex min-h-14 items-center justify-between gap-4 py-3 underline-offset-4 hover:underline" rel="noreferrer"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 text-xs">Download PDF</span></a></li>)}</ul></div>}
          {draft.links.length > 0 && <div className="flex flex-wrap gap-3">{draft.links.filter(link => isSafeProposalUrl(link.url)).map(link => <a key={link.id} href={link.url} onClick={() => track(link.kind === "sign" ? "agreement" : "action", link.id)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-(--proposal-radius) bg-(--proposal-primary) px-5 py-3 text-center font-medium text-(--proposal-on-primary)">{link.label}<span className="sr-only"> (opens in a new tab)</span></a>)}</div>}
          {agencyActions.length > 0 && <section aria-label="Agency contact details" className="space-y-3">
            <h2 className="text-lg font-semibold">Contact {data.agency.name}</h2>
            <div className="flex flex-wrap gap-3">{agencyActions.map(action => <a key={action.href} href={action.href} target={action.href.startsWith("https:") ? "_blank" : undefined} rel={action.href.startsWith("https:") ? "noopener noreferrer" : undefined} className="du-btn du-btn-sm min-h-12 h-auto max-w-full rounded-(--proposal-radius) border-current/25 bg-transparent px-5 py-3 text-inherit shadow-none"><span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{action.label}<span className="mt-1 block text-xs font-normal">{action.value}</span></span>{action.href.startsWith("https:") && <span className="sr-only"> (opens in a new tab)</span>}</a>)}</div>
          </section>}
          {!attachments.length && !draft.links.length && !page.body && !data.agents?.length && !agencyActions.length && <p className="text-(--proposal-muted)">Contact {data.agency.name} to discuss the next steps for your property.</p>}
          {pdfHref && <a href={pdfHref} download onClick={() => track("pdf", "proposal")} className="du-btn du-btn-sm min-h-12 w-full rounded-(--proposal-radius) border-current/25 bg-transparent px-5 text-inherit shadow-none @min-[480px]/proposal:w-auto"><Download size={18} aria-hidden="true" />Download proposal PDF</a>}
          {!pdfHref && previewPdfDownload && <p className="text-sm leading-relaxed text-(--proposal-muted)">PDF downloads are available in the final Get link or PDF step. Create a share link there to prepare your PDF; nothing is sent automatically.</p>}
          <ProposalAgentContacts agents={data.agents ?? []} />
        </div>}
      </section>}
      {page && ["hero", "comparison"].includes(page.kind) && page.body && <p className="mt-6 whitespace-pre-line leading-relaxed">{resolveTokenText(page.body, data).text}</p>}
      {showDisclaimer && <footer className="mt-10 border-t border-current/15 pt-6 text-xs leading-relaxed text-(--proposal-muted)">
        <p>{data.disclaimer}</p>
      </footer>}
    </div>
  </article>;
});

export const EDITORIAL_DIGITAL_TEMPLATE: DigitalTemplateDefinition = { id: "editorial-base", version: 1, Component: DigitalProposal };
