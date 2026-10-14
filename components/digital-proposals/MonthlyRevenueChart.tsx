"use client";

import { useId, useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { managedScenarioLabel } from "@/lib/digital-proposals/presentation";
import { type ProposalData } from "@/lib/digital-proposals/data";
import type { ProposalBrand } from "@/lib/digital-proposals/brand";
import { monthlyRevenueProjection } from "@/lib/digital-proposals/forecastPresentation";
import { formatCurrency } from "@/lib/reports/formatters";

import Chart from "./ProposalChart";
import { ProposalDetailsPopover } from "./ProposalDetailsPopover";
import { useProposalChartMotion } from "./useProposalChartMotion";

export default function MonthlyRevenueChart({ data, brand, motion }: { data: ProposalData; brand: ProposalBrand; motion: boolean }) {
  const headingId = useId();
  const months = useMemo(() => monthlyRevenueProjection(data), [data]);
  const { ref, visible, animate } = useProposalChartMotion(motion, Boolean(months));
  const scenarios = [
    { id: "ltr" as const, label: "Long-term", color: brand.chartLtr, dash: 6 },
    { id: "market" as const, label: "Market STR", color: brand.chartMarket, dash: 3 },
    { id: "managed" as const, label: managedScenarioLabel(data), color: brand.chartManaged, dash: 0 },
  ].filter(scenario => months?.some(month => month[scenario.id] !== null));
  const peak = Math.max(0, ...(months ?? []).flatMap(month => scenarios.map(scenario => month[scenario.id] ?? 0)));
  const stepScale = peak > 0 ? 10 ** Math.floor(Math.log10(peak * 1.1 / 4)) : 1;
  const axisMaximum = peak > 0 ? Math.ceil(peak * 1.1 / 4 / stepScale) * stepScale * 4 : 100;
  const options: ApexOptions = {
    chart: { type: "line", toolbar: { show: false }, zoom: { enabled: false }, parentHeightOffset: 0,
      fontFamily: brand.bodyFont, foreColor: brand.muted, background: "transparent",
      animations: { enabled: animate, speed: 700, dynamicAnimation: { enabled: animate } } },
    colors: scenarios.map(scenario => scenario.color),
    stroke: { curve: "straight", width: scenarios.map(scenario => scenario.id === "managed" ? 3 : 2), dashArray: scenarios.map(scenario => scenario.dash) },
    markers: { size: 0, hover: { size: 5 } },
    dataLabels: { enabled: false }, legend: { show: false },
    grid: { borderColor: brand.muted + "26", strokeDashArray: 4, padding: { left: 0, right: 8 } },
    xaxis: { categories: months?.map(month => month.month) ?? [], tickPlacement: "on", axisBorder: { show: false }, axisTicks: { show: false },
      labels: { rotate: 0, hideOverlappingLabels: true, trim: false, style: { fontSize: "11px" } }, tooltip: { enabled: false } },
    yaxis: { min: 0, max: axisMaximum, tickAmount: 4, labels: { minWidth: 34, maxWidth: 48, style: { fontSize: "11px" }, formatter: value => value >= 1000 ? `$${Number((value / 1000).toFixed(1))}k` : formatCurrency(value) } },
    tooltip: { shared: true, intersect: false, theme: "light", style: { fontSize: "12px" }, y: { formatter: value => formatCurrency(value) } },
    states: { active: { filter: { type: "none" } } },
  };
  if (!months || !scenarios.length) return null;
  return <section aria-labelledby={headingId} className="min-w-0" data-testid="monthly-revenue-section">
    <div className="flex items-center justify-between gap-3">
      <h3 id={headingId} className="font-[family-name:var(--proposal-heading)] text-xl @min-[600px]/proposal:text-2xl">Revenue through the year</h3>
      <ProposalDetailsPopover compact label="View monthly figures" title="Monthly revenue" brand={brand}>
        <div className="max-w-full overflow-x-auto">
          <table className="du-table du-table-sm tabular-nums">
            <caption className="sr-only">Estimated gross revenue by month in Australian dollars</caption>
            <thead><tr><th scope="col">Month</th>{scenarios.map(scenario => <th key={scenario.id} scope="col" className="text-right">{scenario.label}</th>)}</tr></thead>
            <tbody>{months.map(month => <tr key={month.month}><th scope="row">{month.month}</th>{scenarios.map(scenario => <td key={scenario.id} className="text-right">{formatCurrency(month[scenario.id])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </ProposalDetailsPopover>
    </div>
    <p className="mt-1 text-xs text-(--proposal-muted)">Estimated gross revenue by month · seasonal projection</p>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Monthly revenue legend">
      {scenarios.map(scenario => <span key={scenario.id} className="inline-flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2" style={{ borderColor: scenario.color, borderStyle: scenario.dash ? "dashed" : "solid" }} />{scenario.label}</span>)}
    </div>
    <div ref={ref} aria-hidden="true" className="mt-2 min-h-64 w-full min-w-0" data-testid="monthly-revenue-chart">
      {visible && <Chart options={options} series={scenarios.map(scenario => ({ name: scenario.label, data: months.map(month => month[scenario.id]) }))} type="line" height={256} width="100%" />}
    </div>
  </section>;
}
