// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { ProposalComparison } from "./ProposalComparison";
import type { ApexOptions } from "apexcharts";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("./useProposalChartMotion", () => ({ useProposalChartMotion: () => ({ ref: { current: null }, visible: true, animate: false }) }));
vi.mock("./ProposalChart", () => ({ default: ({ options, series }: { options: ApexOptions; series: unknown }) => <div data-testid="chart-data" data-options={JSON.stringify(options)} data-series={JSON.stringify(series)} /> }));
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps the comparison focused on totals with seasonality on its own page", () => {
  render(<ProposalComparison data={createProposalFixture()} brand={BRAND_DEFAULTS} draft={DEFAULT_PROPOSAL_DRAFT} />);
  expect(screen.queryByRole("heading", { name: "Revenue through the year" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
  expect(screen.queryByTestId("monthly-revenue-section")).toBeNull();
  expect(screen.getByTestId("scenario-managed").textContent).toContain("$9,440");
  fireEvent.click(screen.getByRole("button", { name: "Gross yield" }));
  expect(screen.getByTestId("scenario-managed").textContent).toContain("9.1%");
  fireEvent.click(screen.getByRole("button", { name: "Annual" }));
  expect(screen.queryByTestId("monthly-revenue-section")).toBeNull();
});

it("keeps annual totals usable when a legacy report has no seasonal profile", () => {
  const data = createProposalFixture(); data.seasonality = null;
  render(<ProposalComparison data={data} brand={BRAND_DEFAULTS} draft={DEFAULT_PROPOSAL_DRAFT} />);
  expect(screen.queryByTestId("monthly-revenue-section")).toBeNull();
  expect(screen.getByTestId("scenario-managed").textContent).toContain("$113,275");
});

it("preserves the inline revenue chart for previously published page definitions", () => {
  const draft = { ...DEFAULT_PROPOSAL_DRAFT, pages: DEFAULT_PROPOSAL_DRAFT.pages.filter(page => page.kind !== "forecast") };
  render(<ProposalComparison data={createProposalFixture()} brand={BRAND_DEFAULTS} draft={draft} />);
  expect(screen.getByRole("heading", { name: "Revenue through the year" })).toBeTruthy();
});

it("shows two correctly labelled and coloured STR columns when LTR is missing in every comparison view", () => {
  const data = createProposalFixture();
  data.agency.name = "Havenly Property";
  data.ltr = { weeklyRent: null, annualRent: null };
  render(<ProposalComparison data={data} brand={BRAND_DEFAULTS} draft={DEFAULT_PROPOSAL_DRAFT} />);
  for (const [label, values] of [
    ["Annual", [98500, 113275]],
    ["Monthly", [98500 / 12, 113275 / 12]],
    ["Gross yield", [98500 / 1250000 * 100, 113275 / 1250000 * 100]],
  ] as const) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.queryByTestId("scenario-ltr")).toBeNull();
    expect(screen.queryByText("Rental estimate needed")).toBeNull();
    expect(screen.getByTestId("scenario-market").parentElement?.className).toContain("@min-[600px]/proposal:grid-cols-2");
    const chart = screen.getByTestId("chart-data");
    expect(JSON.parse(chart.getAttribute("data-options")!)).toMatchObject({
      colors: [BRAND_DEFAULTS.chartMarket, BRAND_DEFAULTS.chartManaged],
      xaxis: { categories: [["Market", "STR"], ["Havenly", "Property"]] },
    });
    expect(JSON.parse(chart.getAttribute("data-series")!)[0].data).toEqual(values);
  }
});

it("keeps all three comparison columns when LTR is available", () => {
  render(<ProposalComparison data={createProposalFixture()} brand={BRAND_DEFAULTS} draft={DEFAULT_PROPOSAL_DRAFT} />);
  expect(screen.getByTestId("scenario-ltr").textContent).toContain("$59,800");
  const chart = screen.getByTestId("chart-data");
  expect(JSON.parse(chart.getAttribute("data-options")!).colors).toEqual([BRAND_DEFAULTS.chartLtr, BRAND_DEFAULTS.chartMarket, BRAND_DEFAULTS.chartManaged]);
  expect(JSON.parse(chart.getAttribute("data-series")!)[0].data).toEqual([59800, 98500, 113275]);
});
