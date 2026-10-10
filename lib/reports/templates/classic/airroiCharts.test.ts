import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ClassicMonthlyRevenueChart } from "./ClassicMonthlyRevenueChart";
import { ClassicSeasonalityChart } from "./ClassicSeasonalityChart";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { StrMarketOccupancy } from "@/lib/types";
it("labels modelled months and never draws a fabricated confidence band or occupancy history", () => {
  const f = createLintRegressionFixtures();
  const report = f.report.final_report_json!;
  report.str_enrichment = { ...report.str_enrichment!, provider: "airroi", seasonality_basis: "modelled", seasonality: Array.from({length:12},(_,i)=>({month: String(i+1),revenue:5000,revenue_low:null,revenue_high:null,occupancy:null,adr:null,modelled:true})) };
  const revenue = renderToStaticMarkup(createElement(ClassicMonthlyRevenueChart, {report}));
  expect(revenue).toContain("Modelled monthly revenue");
  expect((revenue.match(/<path /g) ?? []).length).toBe(1);
  expect(revenue).not.toContain("Low, median and high");
  const range = renderToStaticMarkup(createElement(ClassicSeasonalityChart, {seasonality:report.str_enrichment.seasonality,revenueRange:{p25:36000,p50:60000,p75:82000,p90:108000}}));
  expect(range).toContain("Annual estimated range");
  expect(range).not.toContain("Occupancy");
});

it("restores monthly market occupancy with genuine percentile bands, explicit geography and gaps", () => {
  const history: StrMarketOccupancy = { status: "available", market: { country: "Australia", region: "New South Wales", locality: "Sydney" }, label: "Sydney · 3-bed rental units", fetched_at: "2026-10-10", request_key: "test", cost_cents: 11, filters: {}, sample_count: null, warnings: [], months: [{ month: "2026-07", average: 55, p25: 30, p50: 58, p75: 79, p90: 90 }, { month: "2026-09", average: 50, p25: 20, p50: 45, p75: 70, p90: 80 }] };
  const html = renderToStaticMarkup(createElement(ClassicSeasonalityChart, { seasonality: [], marketOccupancy: history, revenueRange: { p25: 36000, p50: 60000, p75: 82000, p90: 108000 } }));
  expect(html).toContain("Market occupancy history");
  expect(html).toContain("Sydney · 3-bed rental units");
  expect(html).toContain("Jul 26–Sep 26");
  expect(html).toContain("Aug 26: unavailable");
  expect(html).not.toContain("Annual estimated range");
  expect(html).not.toContain("Avg $0/night");
});
