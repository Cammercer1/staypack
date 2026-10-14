"use client";

import { useRef } from "react";
import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import type { ProposalData } from "@/lib/digital-proposals/data";

const dollars = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);

export function EstimateAssumptions({ data }: { data: ProposalData }) {
  const tooltipContainer = useRef<HTMLDivElement>(null);
  const market = data.str.market.annualRevenue;
  const managed = data.str.managed.annualRevenue;
  const uplift = market !== null && market > 0 && managed !== null ? (managed / market - 1) * 100 : null;
  return <div ref={tooltipContainer}><Popover.Root>
    <Popover.Trigger openOnHover delay={150} closeDelay={100} className="du-btn du-btn-sm du-btn-ghost min-h-11 gap-2 rounded-none border-0 px-0 text-xs font-normal text-primary shadow-none hover:bg-transparent hover:underline">
      <Info size={15} aria-hidden="true" />How this estimate is prepared
    </Popover.Trigger>
    <Popover.Portal container={tooltipContainer}>
    <Popover.Positioner side="top" align="start" sideOffset={8} collisionPadding={16} positionMethod="fixed" className="z-50">
      <Popover.Popup initialFocus={false} finalFocus={false} aria-label="How this estimate is prepared" className="flex max-h-[min(28rem,var(--available-height))] w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-(--proposal-radius) border border-base-300 bg-base-100 p-4 text-xs leading-relaxed text-base-content shadow-lg outline-none">
      {uplift !== null && uplift > 0 && <p>The estimated annual gross STR revenue of {dollars(managed!)} combines a {dollars(market!)} market estimate with an assumed {new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(uplift)}% management uplift. This is a planning assumption, not a measure of past performance or a guaranteed increase.</p>}
      <p>The market estimate considers the property and surrounding rental market. Nearby listings provide context; their revenues are not simply averaged to produce this estimate.</p>
      <p>Presentation, guest capacity, pricing, permitted use and nights available can all affect results. Estimates are before management fees and operating costs; the letting plan and assumptions should be confirmed before proceeding.</p>
      </Popover.Popup>
    </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root></div>;
}

export function ComparableContext({ data }: { data: ProposalData }) {
  const bedrooms = data.comparables.flatMap(comp => comp.bedrooms === null ? [] : [comp.bedrooms]);
  const min = bedrooms.length ? Math.min(...bedrooms) : null;
  const max = bedrooms.length ? Math.max(...bedrooms) : null;
  const differs = data.property.bedrooms !== null && min !== null && max !== null && (data.property.bedrooms < min || data.property.bedrooms > max);
  return <p className="mb-5! max-w-3xl text-sm leading-relaxed text-base-content/70">
    {differs && <>This property has {data.property.bedrooms} bedrooms; the nearby listings shown have {min === max ? min : `${min}–${max}`}. </>}
    The listing estimates below exclude the management uplift included in your rental appraisal.
  </p>;
}
