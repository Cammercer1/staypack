// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { ProposalComparison } from "./ProposalComparison";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
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
