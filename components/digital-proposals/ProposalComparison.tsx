"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { comparisonRows, type ComparisonMode } from "@/lib/digital-proposals/presentation";
import { resolveTokenText } from "@/lib/digital-proposals/tokens";
import { formatCurrency } from "@/lib/reports/formatters";
import type { ProposalTemplateProps } from "./DigitalProposal";
import { useProposalTracking } from "./ProposalTracking";
import RentalComparisonChart from "./RentalComparisonChart";
import MonthlyRevenueChart from "./MonthlyRevenueChart";

export function ProposalComparison({ data, brand, draft }: ProposalTemplateProps) {
  const track = useProposalTracking();
  const [selectedMode, setSelectedMode] = useState<ComparisonMode>(draft.initialComparisonMode);
  const mode = selectedMode;
  const rows = comparisonRows(data, mode);
  const hasValue = data.property.estimatedValue !== null && data.property.estimatedValue > 0;
  return <section aria-labelledby="rental-comparison-heading">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-lg">
        <h2 tabIndex={-1} id="rental-comparison-heading" className="font-[family-name:var(--proposal-heading)] text-[clamp(1.75rem,3.8cqi,3rem)] leading-tight tracking-tight">{resolveTokenText(draft.content.comparisonTitle, data).text}</h2>
      </div>
      <div role="group" aria-label="Comparison view" className="grid w-full grid-cols-3 gap-1 rounded-(--proposal-radius) bg-(--proposal-surface) p-1 @min-[600px]/proposal:w-auto">
        {(["annual", "monthly", "yield"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setSelectedMode(value); track("comparison", value); }} className={cn("min-h-11 cursor-pointer rounded-(--proposal-radius) px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2", mode === value ? "bg-(--proposal-primary) text-(--proposal-on-primary)" : "hover:bg-(--proposal-bg)")}>
          {value === "annual" ? "Annual" : value === "monthly" ? "Monthly" : "Gross yield"}
        </button>)}
      </div>
    </div>
    {mode === "yield" && !hasValue ? <p role="status" className="my-8 rounded-(--proposal-radius) bg-(--proposal-surface) p-5">Add an estimated property value to compare gross yields.</p> : <>
      <dl className={cn("mt-5 grid @min-[600px]/proposal:gap-6", rows.length === 2 ? "@min-[600px]/proposal:grid-cols-2" : "@min-[600px]/proposal:grid-cols-3")} aria-label="Rental comparison figures">
        {rows.map(row => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-t border-current/15 py-3 @min-[600px]/proposal:block @min-[600px]/proposal:py-4" data-testid={`scenario-${row.id}`}>
          <dt className="text-sm font-medium leading-snug">{row.label}</dt>
          <dd className={cn("text-right font-[family-name:var(--proposal-heading)] tabular-nums tracking-tight @min-[600px]/proposal:mt-2 @min-[600px]/proposal:text-left", row.value === null ? "text-sm text-(--proposal-muted)" : "text-2xl @min-[600px]/proposal:text-4xl")}>{row.value === null ? "Not available" : mode === "yield" ? `${row.value.toFixed(1)}%` : formatCurrency(row.value, data.market?.currency)}</dd>
          {row.value === null && <dd className="col-span-2 mt-1 text-xs text-(--proposal-muted)">{row.id === "ltr" ? "Rental estimate needed" : "Scenario not supplied"}</dd>}
        </div>)}
      </dl>
      <p className="mt-2 text-sm text-(--proposal-muted)">{mode === "yield" ? "Estimated gross yields" : `Estimated ${mode === "monthly" ? "monthly" : "annual"} gross revenue`} before management fees and operating costs.</p>
      <div className="mt-6"><RentalComparisonChart data={data} brand={brand} mode={mode} motion={draft.motion} /></div>
      {mode === "yield" && <p className="text-sm text-(--proposal-muted)">Based on an estimated property value of {formatCurrency(data.property.estimatedValue, data.market?.currency)}.</p>}
      {mode === "annual" && !draft.pages.some(page => page.kind === "forecast") && <div className="mt-8 border-t border-current/15 pt-6"><MonthlyRevenueChart data={data} brand={brand} motion={draft.motion} /></div>}
    </>}
    <details className="mt-4 text-sm text-(--proposal-muted)">
      <summary className="w-fit cursor-pointer py-2 focus-visible:outline-2">About these figures</summary>
      <p className="mt-2 max-w-3xl leading-relaxed">All revenue estimates are before management fees and operating expenses. The Monthly tab shows annual averages. Gross yield is annual gross revenue divided by estimated property value. The managed figure is an operating scenario, not a measured management premium.</p>
    </details>
  </section>;
}
