"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, List, LoaderCircle, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { proposalBrandStyle } from "@/lib/digital-proposals/brandStyle";
import { resolveTokenText } from "@/lib/digital-proposals/tokens";
import type { ProposalAttachmentLink } from "@/lib/digital-proposals/workspace";
import { DigitalProposal, type ProposalTemplateProps } from "./DigitalProposal";
import { useProposalPageTracking } from "./ProposalTracking";
import { useProposalPreload } from "./useProposalPreload";
import { PreparedProposalPage } from "./PreparedProposalPage";
import styles from "./ComparableListings.module.css";
import pageStyles from "./MultiPageProposal.module.css";
import { PropertyProvidersProposal } from "./property-providers/PropertyProvidersProposal";

const NO_ATTACHMENTS: ProposalAttachmentLink[] = [];

type MultiPageProps = ProposalTemplateProps & {
  attachments?: ProposalAttachmentLink[]; initialPage?: string; publicPath?: string; previewPdfDownload?: boolean; pdfHref?: string; exampleAgreement?: boolean;
};

export function MultiPageProposal(props: MultiPageProps) {
  if (["property-providers", "agency-proposal"].includes(props.draft.templateId)) return <PropertyProvidersProposal {...props} />;
  return <EditorialMultiPageProposal {...props} />;
}

function EditorialMultiPageProposal({ data, brand, draft, attachments = NO_ATTACHMENTS, initialPage, publicPath, previewPdfDownload = false, pdfHref, fullViewport = false }: ProposalTemplateProps & {
  attachments?: ProposalAttachmentLink[]; initialPage?: string; publicPath?: string; previewPdfDownload?: boolean; pdfHref?: string;
}) {
  const pages = useMemo(() => draft.pages.filter(page => page.enabled), [draft.pages]);
  const [selected, setSelected] = useState(initialPage ?? pages[0]?.id);
  const [contentsOpen, setContentsOpen] = useState(false);
  const proposalRef = useRef<HTMLDivElement>(null);
  const shouldFocusPage = useRef(false);
  const active = pages.find(page => page.id === selected) ?? pages[0];
  const [mounted, setMounted] = useState(() => new Set([active?.id]));
  const ready = useRef(new Set<string>());
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const requested = useRef<{ id: string; history: boolean } | null>(null);
  const [opening, setOpening] = useState(active?.kind === "hero" && pages.length > 1);
  const initial = useRef(active?.id);
  const onPrepared = useCallback((id: string) => setMounted(previous => previous.has(id) ? previous : new Set([...previous, id])), []);
  const onError = useCallback((id: string) => { if (requested.current?.id === id) setFailed(true); }, []);
  const warm = useProposalPreload(data, pages, true, active?.id, onPrepared, onError);
  const commit = useCallback((id: string, history: boolean) => {
    if (publicPath && history) window.history.pushState(null, "", `${publicPath}?page=${encodeURIComponent(id)}`);
    requested.current = null;
    setPending(null); setFailed(false); setOpening(false); setSelected(id);
    shouldFocusPage.current = true;
  }, [publicPath]);
  const onReady = useCallback((id: string) => {
    ready.current.add(id);
    const first = pages.findIndex(page => page.id === initial.current);
    if (ready.current.has(initial.current!) && ready.current.has(pages[first + 1]?.id)) setOpening(false);
    if (requested.current?.id === id) commit(id, requested.current.history);
  }, [commit, pages]);
  useEffect(() => {
    const timer = setTimeout(() => setOpening(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(timer);
  }, [pending]);
  const navigate = useCallback((id: string, history = true) => {
    setContentsOpen(false); setFailed(false);
    if (id === active?.id) { requested.current = null; setPending(null); return; }
    if (ready.current.has(id)) { commit(id, history); return; }
    requested.current = { id, history }; setPending(id); warm(id);
  }, [active?.id, commit, warm]);
  const cancelNavigation = () => {
    if (publicPath && requested.current?.history === false && active) window.history.replaceState(null, "", `${publicPath}?page=${encodeURIComponent(active.id)}`);
    requested.current = null; setPending(null); setFailed(false); setOpening(false);
  };
  useProposalPageTracking(active?.id, proposalRef);
  useEffect(() => {
    if (!shouldFocusPage.current || !proposalRef.current) return;
    const root = proposalRef.current.querySelector<HTMLElement>('[data-proposal-page][data-current]');
    if (!root) return;
    root.scrollIntoView({ block: "start", behavior: "instant" });
    const focus = () => {
      const heading = root.querySelector<HTMLElement>("h1, h2");
      if (!heading) return false;
      heading.focus({ preventScroll: true }); shouldFocusPage.current = false; return true;
    };
    if (focus()) return;
    const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active?.id]);
  useEffect(() => {
    if (!publicPath) return;
    const restorePage = () => {
      if (window.location.pathname !== publicPath) return;
      const requested = new URLSearchParams(window.location.search).get("page");
      const id = pages.find(page => page.id === requested)?.id ?? pages[0]?.id;
      if (id) navigate(id, false);
    };
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, [pages, publicPath, navigate]);
  if (!active) return <p className="p-6">Include at least one proposal page.</p>;
  const index = pages.indexOf(active);
  const immersiveCover = fullViewport && active.kind === "hero" && draft.heroLayout === "overlay" && !active.body && index < pages.length - 1;
  const viewportComparables = fullViewport && active.kind === "evidence" && !active.body && index < pages.length - 1;
  const control = (id: string, label: React.ReactNode, className: string, current = false) => publicPath
    ? <a href={`${publicPath}?page=${encodeURIComponent(id)}`} onPointerEnter={() => warm(id)} onFocus={() => warm(id)} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(id);
    }} aria-current={current ? "page" : undefined} className={className}>{label}</a>
    : <button type="button" onClick={() => navigate(id)} aria-current={current ? "page" : undefined} className={className}>{label}</button>;
  const navigationButton = "du-btn du-btn-sm du-btn-ghost min-h-11 min-w-11 rounded-(--proposal-radius) border-0 text-inherit shadow-none hover:bg-(--proposal-surface) focus-visible:outline-2 focus-visible:outline-offset-2";
  const paginationButton = cn(navigationButton, immersiveCover && "hover:bg-white/15");
  return <div ref={proposalRef} style={proposalBrandStyle(brand)} className={cn(pageStyles.proposal, "@container/proposal-navigation min-w-0 bg-(--proposal-bg) font-[family-name:var(--proposal-body)] text-(--proposal-text)", fullViewport && "flex min-h-dvh w-full flex-col")} data-testid="multi-page-proposal">
    {pages.filter(page => mounted.has(page.id)).map(page => <PreparedProposalPage key={page.id} id={page.id} active={page.id === active.id} motion={draft.motion} onReady={onReady} onError={onError}
      className={fullViewport && page.kind === "evidence" && !page.body && pages.indexOf(page) < pages.length - 1 ? styles.viewport : undefined}>
      <DigitalProposal fullViewport={fullViewport} data={data} brand={brand} draft={draft} page={page} attachments={attachments} showDisclaimer={pages.indexOf(page) === pages.length - 1} previewPdfDownload={previewPdfDownload} pdfHref={pdfHref} />
    </PreparedProposalPage>)}
    {(opening || pending) && <div role="status" aria-live="polite" className={cn(fullViewport ? "fixed" : "absolute", "inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border px-5 py-3 text-sm shadow-sm backdrop-blur-md", immersiveCover ? "border-white/20 bg-black/45 text-white" : "border-current/15 bg-(--proposal-bg) text-(--proposal-text)")}>
      {!failed && <LoaderCircle size={16} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />}
      <span>{failed ? "This page is taking longer than expected." : pending ? "Preparing page…" : "Preparing your proposal…"}</span>
      {failed && (publicPath ? <a className="shrink-0 underline underline-offset-4" href={`${publicPath}?page=${encodeURIComponent(pending!)}`}>Reload</a> : <button type="button" className="shrink-0 underline underline-offset-4" onClick={() => window.location.reload()}>Reload</button>)}
      {pending && <button type="button" aria-label="Cancel page change" className="-my-2 flex min-h-11 min-w-11 items-center justify-center" onClick={cancelNavigation}><X size={16} /></button>}
    </div>}
    <nav aria-label="Proposal pagination" aria-busy={Boolean(pending)} className={cn(viewportComparables && styles.navigation, "sticky bottom-0 z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-current/15 bg-(--proposal-bg) px-4 py-3 text-sm", fullViewport && "min-h-[calc(5rem+env(safe-area-inset-bottom))] px-[clamp(1rem,4vw,4rem)] pb-[max(0.75rem,env(safe-area-inset-bottom))]", immersiveCover && "-mt-[calc(5rem+env(safe-area-inset-bottom))] border-transparent bg-transparent text-white")}>
      <div className="justify-self-start">{index > 0 && control(pages[index - 1].id, <><ChevronLeft size={18} aria-hidden="true" /><span className="sr-only @min-[480px]/proposal-navigation:not-sr-only">Previous</span></>, paginationButton)}</div>
      <Dialog open={contentsOpen} onOpenChange={setContentsOpen}>
        <DialogTrigger className={paginationButton} aria-label="Open table of contents">
          <List size={17} aria-hidden="true" /><span>Contents</span><span aria-hidden="true" className={cn("ml-2 font-normal tabular-nums", immersiveCover ? "text-white/70" : "text-(--proposal-muted)")}>{index + 1} / {pages.length}</span>
        </DialogTrigger>
        <DialogContent style={proposalBrandStyle(brand)} showCloseButton={false} className="inset-x-0 top-auto bottom-0 flex max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl bg-(--proposal-bg) p-0 font-[family-name:var(--proposal-body)] text-(--proposal-text) sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-3rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-current/15 px-6 py-5">
            <div className="min-w-0">
              <DialogTitle className="font-[family-name:var(--proposal-heading)] text-2xl leading-tight">Contents</DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-relaxed text-(--proposal-muted) [overflow-wrap:anywhere]">{data.property.address}</DialogDescription>
            </div>
            <DialogClose aria-label="Close contents" className={cn(navigationButton, "shrink-0")}><X size={20} aria-hidden="true" /></DialogClose>
          </div>
          <nav aria-label="Proposal pages" className="min-h-0 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <ul className="du-menu w-full gap-1 p-0">
              {pages.map((page, i) => <li key={page.id}>{control(page.id, <>
                <span className="tabular-nums opacity-65">{String(i + 1).padStart(2, "0")}</span>{" "}
                <span className="min-w-0 [overflow-wrap:anywhere]">{resolveTokenText(page.title, data).text}</span>
                {page.id === active.id && <span aria-hidden="true" className="text-xs font-normal">Current</span>}
              </>, cn("min-h-14 rounded-(--proposal-radius) text-sm focus-visible:outline-2 focus-visible:outline-offset-2", page.id === active.id ? "bg-(--proposal-primary) font-medium text-(--proposal-on-primary)" : "hover:bg-(--proposal-surface)"), page.id === active.id)}</li>)}
            </ul>
          </nav>
        </DialogContent>
      </Dialog>
      <div className="justify-self-end">{index < pages.length - 1 && control(pages[index + 1].id, <><span className="sr-only @min-[480px]/proposal-navigation:not-sr-only">Next</span><ChevronRight size={18} aria-hidden="true" /></>, paginationButton)}</div>
      <span aria-live="polite" className="sr-only">Page {index + 1} of {pages.length}: {resolveTokenText(active.title, data).text}</span>
    </nav>
  </div>;
}
