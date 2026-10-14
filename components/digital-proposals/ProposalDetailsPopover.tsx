"use client";

import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Info, Table2, X } from "lucide-react";
import { proposalBrandStyle } from "@/lib/digital-proposals/brandStyle";
import type { ProposalBrand } from "@/lib/digital-proposals/brand";
import { useProposalPageVisible } from "./PreparedProposalPage";

export function ProposalDetailsPopover({ label, title, brand, children, compact = false }: {
  label: string; title: string; brand: ProposalBrand; children: ReactNode; compact?: boolean;
}) {
  const visible = useProposalPageVisible();
  // A cached page must not leave its portal open after navigation or reopen it on return.
  return <Popover.Root key={visible ? "visible" : "hidden"}>
    <Popover.Trigger aria-label={label} title={label} className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-xs text-(--proposal-muted) transition-colors hover:bg-(--proposal-surface) focus-visible:outline-2 focus-visible:outline-offset-2">
      {compact ? <Table2 size={16} aria-hidden="true" /> : <><Info size={15} aria-hidden="true" />{label}</>}
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={16} className="z-50">
        <Popover.Popup style={proposalBrandStyle(brand)} className="flex max-h-[min(32rem,75dvh,var(--available-height))] w-[28rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-current/15 bg-(--proposal-bg) font-[family-name:var(--proposal-body)] text-(--proposal-text) shadow-xl outline-none">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-current/10 py-2 pr-2 pl-5">
            <Popover.Title className="font-[family-name:var(--proposal-heading)] text-lg leading-tight">{title}</Popover.Title>
            <Popover.Close aria-label={`Close ${title.toLowerCase()}`} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-(--proposal-surface) focus-visible:outline-2"><X size={18} aria-hidden="true" /></Popover.Close>
          </div>
          <div tabIndex={0} role="region" aria-label={`${title} details`} className="min-h-0 overflow-auto overscroll-contain px-4 py-3 text-xs leading-relaxed focus-visible:outline-2 focus-visible:-outline-offset-2 [&_th]:text-(--proposal-muted)">{children}</div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
