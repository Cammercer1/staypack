"use client";

import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { comparisonRows, managedScenarioLabel } from "@/lib/digital-proposals/presentation";
import { type ComparisonMode, type ProposalData } from "@/lib/digital-proposals/data";
import type { ProposalBrand } from "@/lib/digital-proposals/brand";
import { formatCurrency } from "@/lib/reports/formatters";

import Chart from "./ProposalChart";
import { useProposalChartMotion } from "./useProposalChartMotion";
export default function RentalComparisonChart({ data, brand, mode, motion }: {
  data: ProposalData; brand: ProposalBrand; mode: ComparisonMode; motion: boolean;
}) {
  const { ref, visible, animate } = useProposalChartMotion(motion);
  const rows = useMemo(() => comparisonRows(data, mode), [data, mode]);
  const managedLabel = managedScenarioLabel(data);
  const options: ApexOptions = useMemo(() => ({
    chart: {
      type: "bar", toolbar: { show: false }, zoom: { enabled: false },
      animations: { enabled: animate, speed: 650, dynamicAnimation: { enabled: animate, speed: 350 } },
      fontFamily: brand.bodyFont, foreColor: brand.muted, background: "transparent", parentHeightOffset: 0,
    },
    colors: rows.map(row => ({ ltr: brand.chartLtr, market: brand.chartMarket, managed: brand.chartManaged })[row.id]),
    plotOptions: { bar: { distributed: true, horizontal: false, columnWidth: "46%", borderRadius: Math.min(brand.radius, 8) } },
    dataLabels: { enabled: false }, legend: { show: false },
    grid: { borderColor: brand.muted + "26", strokeDashArray: 4 },
    xaxis: { categories: rows.map(row => ({ ltr: ["Long-term"], market: ["Market", "STR"], managed: managedLabel.split(/\s+/) })[row.id]), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { fontSize: "12px" }, trim: false, rotate: 0 } },
    yaxis: { min: 0, tickAmount: 4, labels: { formatter: value => mode === "yield" ? `${value.toFixed(1)}%` : `$${Math.round(value / 1000)}k` } },
    tooltip: { shared: false, intersect: false, theme: "light", y: { formatter: value => value == null ? "Not available" : mode === "yield" ? `${value.toFixed(1)}%` : formatCurrency(value, data.market?.currency) } },
    states: { hover: { filter: { type: "lighten" } }, active: { filter: { type: "none" } } },
  }), [brand, mode, animate, managedLabel, data.market?.currency, rows]);

  return <div ref={ref} className="min-h-72 w-full min-w-0" aria-hidden="true" data-testid="rental-chart">
    {visible && <Chart options={options} series={[{ name: mode === "yield" ? "Estimated gross yield" : "Estimated gross revenue", data: rows.map(row => row.value) }]} type="bar" height={288} width="100%" />}
  </div>;
}
