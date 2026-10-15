// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { YearlyForecast } from "./YearlyForecast";

vi.mock("./ProposalChart", () => ({ default: () => null }));
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("opens figures in dismissible popovers without expanding the chart sections", async () => {
  const data = createProposalFixture();
  data.occupancy!.months[0].average = null;
  render(<YearlyForecast data={data} brand={BRAND_DEFAULTS} motion />);
  expect(screen.getByRole("heading", { name: "Revenue through the year" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Occupancy" })).toBeTruthy();
  expect(screen.getByText("Historical market average · Jan 2025 – Dec 2025")).toBeTruthy();
  const revenueTrigger = screen.getByRole("button", { name: "View monthly figures" });
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.click(revenueTrigger);
  const revenue = await screen.findByRole("dialog", { name: "Monthly revenue" });
  expect(within(revenue).getByRole("table").querySelectorAll("tbody tr")).toHaveLength(12);
  expect(screen.getByTestId("monthly-revenue-section").contains(revenue)).toBe(false);
  fireEvent.keyDown(revenue, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "View occupancy figures" }));
  const occupancy = await screen.findByRole("dialog", { name: "Monthly occupancy" });
  expect(within(occupancy).getByRole("table").querySelectorAll("tbody tr")).toHaveLength(12);
  expect(within(occupancy).getByRole("table").textContent).toContain("Not available");
  fireEvent.click(within(occupancy).getByRole("button", { name: "Close monthly occupancy" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByRole("table")).toBeNull();
});
it("handles missing revenue or occupancy independently without inventing a flat chart", () => {
  const data = createProposalFixture(); data.occupancy = null;
  const view = render(<YearlyForecast data={data} brand={BRAND_DEFAULTS} motion={false} />);
  expect(screen.getByText("Monthly occupancy history is not available for this market.")).toBeTruthy();
  expect(screen.queryByTestId("monthly-occupancy-chart")).toBeNull();
  expect(screen.getByTestId("monthly-revenue-chart")).toBeTruthy();
  view.rerender(<YearlyForecast data={{ ...createProposalFixture(), seasonality: null }} brand={BRAND_DEFAULTS} motion={false} />);
  expect(screen.getByText("Monthly revenue estimates are not available for this appraisal.")).toBeTruthy();
  expect(screen.getByTestId("monthly-occupancy-chart")).toBeTruthy();
});

it("shows the frozen unavailable explanation for new proposals", () => {
  const data = { ...createProposalFixture(), occupancy: null, occupancyNotice: "Monthly occupancy history is unavailable for Edgeworth with this bedroom count." };
  render(<YearlyForecast data={data} brand={BRAND_DEFAULTS} motion={false} />);
  expect(screen.getByText(data.occupancyNotice)).toBeTruthy();
  expect(screen.queryByTestId("monthly-occupancy-chart")).toBeNull();
});
