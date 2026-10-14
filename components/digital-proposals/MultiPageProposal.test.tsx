// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { MultiPageProposal } from "./MultiPageProposal";

const holds = vi.hoisted(() => new Map<string, Promise<void>>());
vi.mock("./proposalPageModules", async importOriginal => {
  const original = await importOriginal<typeof import("./proposalPageModules")>();
  return { preloadProposalPage: async (kind: Parameters<typeof original.preloadProposalPage>[0]) => {
    await holds.get(kind); await original.preloadProposalPage(kind);
  } };
});
vi.mock("./RentalComparisonChart", () => ({ default: () => null }));
vi.mock("./MonthlyRevenueChart", () => ({ default: () => null }));
vi.mock("./ProposalChart", () => ({ default: () => null, preloadProposalCharts: () => Promise.resolve({}) }));
beforeEach(() => {
  holds.clear();
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  window.history.replaceState(null, "", "/proposal/public-token");
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const props = { data: createProposalFixture(), brand: BRAND_DEFAULTS, draft: DEFAULT_PROPOSAL_DRAFT };
const openContents = () => fireEvent.click(screen.getByRole("button", { name: "Open table of contents" }));

it("opens only included pages, jumps to a page, closes and keeps sequential navigation working", async () => {
  render(<MultiPageProposal {...props} />);
  expect(screen.queryByRole("navigation", { name: "Proposal pages" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
  openContents();
  const contents = within(screen.getByRole("dialog", { name: "Contents" }));
  expect(contents.queryByRole("button", { name: /Our management service/ })).toBeNull();
  expect(contents.getByRole("button", { name: "01 Your property" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(contents.getByRole("button", { name: "05 Next steps" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(await screen.findByRole("heading", { name: "Next steps" })).toBeTruthy();
  expect(screen.getByText(props.data.disclaimer)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(await screen.findByRole("heading", { name: "Comparable listings" }, { timeout: 3000 })).toBeTruthy();
  expect(within(document.querySelector("[data-proposal-page][data-current]") as HTMLElement).queryByText(props.data.disclaimer)).toBeNull();
});

it("dismisses with Escape and returns focus to Contents", async () => {
  render(<MultiPageProposal {...props} />);
  const trigger = screen.getByRole("button", { name: "Open table of contents" });
  trigger.focus();
  openContents();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("keeps public page links and numbering consistent with enabled page order", () => {
  const draft = { ...props.draft, pages: [...props.draft.pages].reverse() };
  render(<MultiPageProposal {...props} draft={draft} initialPage="appraisal" publicPath="/proposal/public-token" />);
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/proposal/public-token?page=property");
  openContents();
  const contents = within(screen.getByRole("dialog"));
  expect(contents.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([
    "/proposal/public-token?page=next-steps", "/proposal/public-token?page=evidence",
    "/proposal/public-token?page=forecast", "/proposal/public-token?page=appraisal", "/proposal/public-token?page=property",
  ]);
  expect(contents.getByRole("link", { name: "04 Rental appraisal" }).getAttribute("aria-current")).toBe("page");
});

it("changes public pages when prepared without fetching, and restores pages with browser history", async () => {
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  const push = vi.spyOn(window.history, "pushState");
  render(<MultiPageProposal {...props} publicPath="/proposal/public-token" fullViewport />);
  fireEvent.click(screen.getByRole("link", { name: "Next" }));
  const heading = await screen.findByRole("heading", { name: "Your rental income potential" });
  expect(window.location.search).toBe("?page=appraisal");
  expect(push).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(heading));
  openContents();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "05 Next steps" }));
  expect(await screen.findByRole("heading", { name: "Next steps" })).toBeTruthy();
  expect(window.location.search).toBe("?page=next-steps");
  // Emulate the URL + popstate delivered by a browser Back/Forward traversal.
  act(() => { window.history.replaceState(null, "", "/proposal/public-token?page=appraisal"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(await screen.findByRole("heading", { name: "Your rental income potential" })).toBeTruthy();
  act(() => { window.history.replaceState(null, "", "/proposal/public-token"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(screen.getByRole("heading", { name: props.data.property.address })).toBeTruthy();
  expect(push).toHaveBeenCalledTimes(2);
  expect(request).not.toHaveBeenCalled();
});

it("leaves modified link clicks to the browser", () => {
  const push = vi.spyOn(window.history, "pushState");
  render(<MultiPageProposal {...props} publicPath="/proposal/public-token" />);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  document.addEventListener("click", received => {
    expect(received.defaultPrevented).toBe(false);
    received.preventDefault(); // Suppress jsdom's unsupported new-document navigation.
  }, { once: true });
  fireEvent(screen.getByRole("link", { name: "Next" }), event);
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: props.data.property.address })).toBeTruthy();
});

it("places the forecast between appraisal and comparable listings, including direct links", async () => {
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  render(<MultiPageProposal {...props} initialPage="appraisal" publicPath="/proposal/public-token" />);
  fireEvent.click(screen.getByRole("link", { name: "Next" }));
  expect(await screen.findByRole("heading", { name: "Yearly forecast" })).toBeTruthy();
  expect(await screen.findByRole("heading", { name: "Occupancy" })).toBeTruthy();
  expect(window.location.search).toBe("?page=forecast");
  expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toContain("page=appraisal");
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toContain("page=evidence");
  expect(request).not.toHaveBeenCalled();
});


it("keeps the cover visible during preparation and honours the latest destination", async () => {
  let comparisonReady!: () => void, forecastReady!: () => void;
  holds.set("comparison", new Promise(resolve => { comparisonReady = resolve; }));
  holds.set("forecast", new Promise(resolve => { forecastReady = resolve; }));
  const push = vi.spyOn(window.history, "pushState");
  render(<MultiPageProposal {...props} publicPath="/proposal/public-token" />);
  fireEvent.click(screen.getByRole("link", { name: "Next" }));
  expect(screen.getByRole("heading", { name: props.data.property.address })).toBeTruthy();
  expect(screen.getByText("Preparing page…")).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
  openContents();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "03 Yearly forecast" }));
  await act(async () => comparisonReady());
  await waitFor(() => expect(document.querySelector('[data-proposal-page="appraisal"]')).toBeTruthy());
  expect(screen.queryByRole("heading", { name: "Your rental income potential" })).toBeNull();
  expect(push).not.toHaveBeenCalled();
  await act(async () => forecastReady());
  expect(await screen.findByRole("heading", { name: "Yearly forecast" })).toBeTruthy();
  expect(window.location.search).toBe("?page=forecast");
  expect(push).toHaveBeenCalledTimes(1);
});

it("preserves the comparison tab and mounted page when navigating away and back", async () => {
  render(<MultiPageProposal {...props} publicPath="/proposal/public-token" initialPage="appraisal" />);
  const monthly = await screen.findByRole("button", { name: "Monthly" });
  fireEvent.click(monthly);
  fireEvent.click(screen.getByRole("link", { name: "Next" }));
  await screen.findByRole("heading", { name: "Yearly forecast" });
  expect(document.contains(monthly)).toBe(true);
  expect(screen.queryByRole("button", { name: "Monthly" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Previous" }));
  expect(await screen.findByRole("button", { name: "Monthly" })).toBe(monthly);
  expect(monthly.getAttribute("aria-pressed")).toBe("true");
});

it("keeps the current page on module failure and cancels a pending page change", async () => {
  let fail!: (reason: Error) => void;
  holds.set("comparison", new Promise((_resolve, reject) => { fail = reject; }));
  render(<MultiPageProposal {...props} publicPath="/proposal/public-token" />);
  fireEvent.click(screen.getByRole("link", { name: "Next" }));
  await act(async () => fail(new Error("Offline")));
  expect(await screen.findByRole("link", { name: "Reload" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: props.data.property.address })).toBeTruthy();
  expect(window.location.search).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Cancel page change" }));
  expect(screen.queryByRole("link", { name: "Reload" })).toBeNull();
});

it("ends the opening indicator after its budget even if background code stalls", async () => {
  vi.useFakeTimers();
  try {
    holds.set("comparison", new Promise(() => {}));
    holds.set("forecast", new Promise(() => {}));
    render(<MultiPageProposal {...props} publicPath="/proposal/public-token" />);
    expect(screen.getByText("Preparing your proposal…")).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(3100));
    expect(screen.queryByText("Preparing your proposal…")).toBeNull();
    expect(screen.getByRole("heading", { name: props.data.property.address })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Next" }));
    expect(screen.getByText("Preparing page…")).toBeTruthy();
    expect(window.location.search).toBe("");
  } finally { cleanup(); vi.useRealTimers(); }
});
