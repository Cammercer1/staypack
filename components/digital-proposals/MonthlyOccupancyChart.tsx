"use client";

import { useId } from "react";
import type { ApexOptions } from "apexcharts";
import type { ProposalBrand } from "@/lib/digital-proposals/brand";
import type { OccupancyProfile } from "@/lib/digital-proposals/occupancy";
import { occupancyMonthLabel } from "@/lib/digital-proposals/forecastPresentation";
import { CALENDAR_MONTHS } from "@/lib/digital-proposals/forecastPresentation";
import Chart from "./ProposalChart";
import { ProposalDetailsPopover } from "./ProposalDetailsPopover";
import { useProposalChartMotion } from "./useProposalChartMotion";

const percent = (value: number | null) => value === null ? "Not available" : `${Math.round(value)}%`;

export function MonthlyOccupancyChart({ occupancy, brand, motion }: { occupancy: OccupancyProfile; brand: ProposalBrand; motion: boolean }) {
  const headingId = useId();
  const { ref, visible, animate } = useProposalChartMotion(motion);
  const months = occupancy.months;
  const period = `${occupancyMonthLabel(months[0].month)} – ${occupancyMonthLabel(months.at(-1)!.month)}`;
  const options: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, zoom: { enabled: false }, parentHeightOffset: 0,
      fontFamily: brand.bodyFont, foreColor: brand.muted, background: "transparent",
      animations: { enabled: animate, speed: 700, dynamicAnimation: { enabled: animate } } },
    colors: [brand.chartMarket], plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
    dataLabels: { enabled: false }, legend: { show: false },
    grid: { borderColor: brand.muted + "26", strokeDashArray: 4, padding: { left: 0, right: 8 } },
    xaxis: { categories: months.map(row => row.month), axisBorder: { show: false }, axisTicks: { show: false },
      labels: { rotate: 0, hideOverlappingLabels: true, trim: false, style: { fontSize: "11px" }, formatter: value => CALENDAR_MONTHS[Number(String(value).slice(5, 7)) - 1] ?? value },
      tooltip: { enabled: false } },
    yaxis: { min: 0, max: 100, tickAmount: 4, labels: { minWidth: 34, maxWidth: 48, style: { fontSize: "11px" }, formatter: value => `${Math.round(value)}%` } },
    tooltip: { theme: "light", style: { fontSize: "12px" }, x: { formatter: (_value, context) => occupancyMonthLabel(months[context?.dataPointIndex ?? 0].month) }, y: { formatter: value => percent(value) } },
    states: { active: { filter: { type: "none" } } },
  };
  return <section aria-labelledby={headingId} className="min-w-0" data-testid="monthly-occupancy-section">
    <div className="flex items-center justify-between gap-3">
      <h3 id={headingId} className="font-[family-name:var(--proposal-heading)] text-xl @min-[600px]/proposal:text-2xl">Occupancy</h3>
      <ProposalDetailsPopover compact label="View occupancy figures" title="Monthly occupancy" brand={brand}>
        <table className="du-table du-table-sm tabular-nums">
          <caption className="sr-only">Historical market occupancy by month</caption>
          <thead><tr><th scope="col">Month</th><th scope="col" className="text-right">Occupancy</th></tr></thead>
          <tbody>{months.map(row => <tr key={row.month}><th scope="row">{occupancyMonthLabel(row.month)}</th><td className="text-right">{percent(row.average)}</td></tr>)}</tbody>
        </table>
      </ProposalDetailsPopover>
    </div>
    <p className="mt-1 text-xs text-(--proposal-muted)">Historical market average · {period}</p>
    <div className="mt-4 flex min-h-4 items-center gap-2 text-xs"><span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: brand.chartMarket }} />Market occupancy</div>
    <div ref={ref} aria-hidden="true" className="mt-2 min-h-64 w-full min-w-0" data-testid="monthly-occupancy-chart">
      {visible && <Chart options={options} series={[{ name: "Market occupancy", data: months.map(row => row.average) }]} type="bar" height={256} width="100%" />}
    </div>
  </section>;
}
