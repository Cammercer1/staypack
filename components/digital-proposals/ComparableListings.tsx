"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import type { ProposalData } from "@/lib/digital-proposals/data";
import { formatCurrency } from "@/lib/reports/formatters";
import { cn } from "@/lib/utils";

function carouselPosition(track: HTMLDivElement) {
  const first = track.children[0] as HTMLElement | undefined;
  const second = track.children[1] as HTMLElement | undefined;
  const stride = first ? (second ? second.offsetLeft - first.offsetLeft : first.offsetWidth) : 0;
  const visible = stride > 0 ? Math.max(1, Math.round(track.clientWidth / stride)) : 1;
  const start = stride > 0 ? Math.max(0, Math.min(track.children.length - visible, Math.round(track.scrollLeft / stride))) : 0;
  return { start, end: Math.min(track.children.length, start + visible), stride };
}

export function ComparableListings({ comparables, currency, motion, maxVisible = 2, className, renderComparable }: {
  currency?: "AUD" | "USD";
  comparables: ProposalData["comparables"]; motion: boolean;
  maxVisible?: 2 | 3;
  className?: string;
  renderComparable?: (comparable: ProposalData["comparables"][number], index: number) => ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const trackId = useId();
  const [range, setRange] = useState({ start: 0, end: 1 });
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const { start, end } = carouselPosition(track);
      setRange(previous => previous.start === start && previous.end === end ? previous : { start, end });
    };
    const observer = new ResizeObserver(update);
    observer.observe(track);
    track.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); track.removeEventListener("scroll", update); };
  }, [comparables.length]);

  function navigate(destination: "previous" | "next" | "first" | "last") {
    const track = trackRef.current;
    if (!track) return;
    const { start, stride } = carouselPosition(track);
    const index = destination === "first" ? 0 : destination === "last" ? comparables.length - 1 : start + (destination === "next" ? 1 : -1);
    // CSS supplies smooth scrolling only when motion is enabled and the reader allows it.
    track.scrollTo({ left: Math.max(0, Math.min(track.scrollWidth - track.clientWidth, index * stride)), behavior: "auto" });
  }

  const controlClass = "du-btn du-btn-sm du-btn-square min-h-11 min-w-11 rounded-(--proposal-radius) border-current/20 bg-transparent text-inherit shadow-none hover:bg-(--proposal-surface) focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-transparent disabled:text-(--proposal-muted) disabled:opacity-40";
  return <div data-proposal-carousel className={cn("@container/comparables mt-6", className)}>
    {comparables.length > 0 ? <>
      <div ref={trackRef} id={trackId} role="region" aria-roledescription="carousel" aria-label="Comparable listings" tabIndex={comparables.length > 1 ? 0 : undefined}
        className={cn("du-carousel relative w-full gap-5 overscroll-x-contain rounded-(--proposal-radius) scroll-auto focus-visible:outline-2 focus-visible:outline-offset-4", motion && "motion-safe:scroll-smooth")}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
          const destination = ({ ArrowLeft: "previous", ArrowRight: "next", Home: "first", End: "last" } as const)[event.key as "ArrowLeft" | "ArrowRight" | "Home" | "End"];
          if (destination) { event.preventDefault(); navigate(destination); }
        }}>
        {comparables.map((comp, index) => <div key={`${comp.name}-${index}`} data-proposal-comparable={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${comparables.length}: ${comp.name}`}
          className={cn("du-carousel-item min-w-0 w-full flex-col", comparables.length > 1 && "@max-[599px]/comparables:w-[calc(100%-2rem)] @min-[600px]/comparables:w-[calc((100%-1.25rem)/2)]", comparables.length > 2 && maxVisible === 3 && "@min-[1000px]/comparables:w-[calc((100%-2.5rem)/3)]")}>
          {renderComparable ? renderComparable(comp, index) : <><div data-comparable-media className="relative aspect-[8/5] w-full shrink-0 overflow-hidden rounded-(--proposal-radius) bg-(--proposal-surface)">
            {comp.imageUrl ? <Image unoptimized loading={index < 2 ? "eager" : "lazy"} src={comp.imageUrl} alt={comp.name} fill className="object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-(--proposal-muted)"><ImageIcon size={20} aria-hidden="true" />Photo unavailable</div>}
          </div>
          <div data-comparable-details className="flex flex-1 flex-col pt-4">
            <h2 title={comp.name} className="font-[family-name:var(--proposal-heading)] text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{comp.name}</h2>
            <p className="mt-2 text-sm text-(--proposal-muted)">{[comp.bedrooms !== null ? `${comp.bedrooms} ${comp.bedrooms === 1 ? "bedroom" : "bedrooms"}` : "", comp.distanceM !== null ? `${(comp.distanceM / 1000).toFixed(1)} km away` : ""].filter(Boolean).join(" · ")}</p>
            <div className="mt-auto pt-4">
              <p className="font-[family-name:var(--proposal-heading)] text-3xl tabular-nums">{comp.annualRevenue !== null ? formatCurrency(comp.annualRevenue, currency) : "Not available"}</p>
              <p className="mt-1 text-xs text-(--proposal-muted)">Estimated gross STR revenue / year</p>
            </div>
          </div></>}
        </div>)}
      </div>
      {comparables.length > 1 && <div data-comparable-controls className="mt-5 flex items-center justify-between gap-4">
        <p role="status" aria-atomic="true" className="text-sm tabular-nums text-(--proposal-muted)"><span className="sr-only">Listings </span>{range.start + 1}{range.end > range.start + 1 ? `–${range.end}` : ""} of {comparables.length}</p>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous comparable" aria-controls={trackId} className={controlClass} disabled={range.start === 0} onClick={() => navigate("previous")}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Next comparable" aria-controls={trackId} className={controlClass} disabled={range.end >= comparables.length} onClick={() => navigate("next")}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>}
    </> : <p className="text-sm text-(--proposal-muted)">No comparable listings included.</p>}
  </div>;
}
