// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_PAGES } from "@/lib/digital-proposals/template";
import { useProposalPreload } from "./useProposalPreload";

const moduleLoad = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("./proposalPageModules", () => ({ preloadProposalPage: moduleLoad }));
const images: { src: string; fetchPriority: string; onload: (() => void) | null; onerror: (() => void) | null }[] = [];
function fixture() {
  const data = createProposalFixture();
  data.comparables = Array.from({ length: 6 }, (_, i) => ({ name: `Nearby ${i}`, imageUrl: `https://example.com/comp-${i}.jpg`, bedrooms: 2, annualRevenue: 90000, distanceM: 100 }));
  data.agents = [{ name: "Agent", photoUrl: "https://example.com/agent.jpg", email: "", phone: "", role: "" }];
  return data;
}
beforeEach(() => {
  vi.useFakeTimers(); moduleLoad.mockReset().mockResolvedValue(undefined); images.length = 0;
  vi.stubGlobal("Image", class {
    src = ""; fetchPriority = ""; onload = null; onerror = null;
    constructor() { images.push(this); }
  });
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); Reflect.deleteProperty(navigator, "connection"); });
const startBackground = () => act(() => vi.advanceTimersByTimeAsync(200));
const completeImages = async () => {
  for (let i = 0; i < 10; i++) await act(async () => { images.forEach(image => image.onload?.()); });
};

it("warms page code after the cover paints without waiting for slow images or fetching downloads", async () => {
  const hero = document.createElement("img"); hero.dataset.proposalCriticalImage = "";
  Object.defineProperty(hero, "complete", { value: false }); document.body.append(hero);
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  const data = fixture();
  renderHook(() => useProposalPreload(data, DEFAULT_PROPOSAL_PAGES, true));
  await startBackground();
  expect(moduleLoad).toHaveBeenCalledWith("next_steps"); // Slow comparable photos cannot hold up page code.
  expect(moduleLoad.mock.calls[0][0]).toBe("comparison");
  expect(moduleLoad).not.toHaveBeenCalledWith("hero");
  expect(images).toHaveLength(2); // All six comparable photos must not start together.
  await completeImages();
  expect(images.map(image => image.src)).toContain("https://example.com/agent.jpg");
  expect(images.map(image => image.src)).not.toContain(data.property.heroImageUrl);
  expect(images.map(image => image.src)).not.toContain(data.property.gallery[0]);
  expect(request).not.toHaveBeenCalled();
});

it("prioritises an immediate destination before the cover finishes and deduplicates repeated intent", async () => {
  const { result } = renderHook(() => useProposalPreload(fixture(), DEFAULT_PROPOSAL_PAGES, true));
  act(() => result.current("next-steps"));
  expect(moduleLoad).toHaveBeenCalledWith("next_steps");
  expect(images[0].src).toBe("https://example.com/agent.jpg");
  expect(images[0].fetchPriority).toBe("high");
  act(() => result.current("next-steps"));
  expect(images).toHaveLength(1);
});

it("promotes a queued page ahead of the remaining comparable photos", async () => {
  const { result } = renderHook(() => useProposalPreload(fixture(), DEFAULT_PROPOSAL_PAGES, true));
  await startBackground();
  act(() => result.current("next-steps"));
  await act(async () => images[0].onload?.());
  expect(images[2].src).toBe("https://example.com/agent.jpg");
  expect(images[2].fetchPriority).toBe("high");
});

it("ignores disabled pages and retries a failed image on later interaction", async () => {
  const pages = DEFAULT_PROPOSAL_PAGES.map(page => ({ ...page, enabled: page.kind === "hero" || page.kind === "next_steps" }));
  const { result } = renderHook(() => useProposalPreload(fixture(), pages, true));
  act(() => result.current("evidence"));
  await startBackground();
  expect(moduleLoad).not.toHaveBeenCalledWith("evidence");
  await act(async () => images[0].onerror?.());
  act(() => result.current("next-steps"));
  expect(images).toHaveLength(2);
});

it("prepares the following page after a direct link and respects data saving", async () => {
  Object.defineProperty(navigator, "connection", { configurable: true, get: () => ({ saveData: true }) });
  renderHook(() => useProposalPreload(fixture(), DEFAULT_PROPOSAL_PAGES, true, "appraisal"));
  await startBackground();
  expect(moduleLoad.mock.calls.map(call => call[0])).toEqual(["forecast"]);
  expect(images).toHaveLength(0);
});

it("cancels automatic work on unmount and leaves editor previews alone", async () => {
  const data = fixture();
  const view = renderHook(() => useProposalPreload(data, DEFAULT_PROPOSAL_PAGES, true)); view.unmount();
  const { result } = renderHook(() => useProposalPreload(data, DEFAULT_PROPOSAL_PAGES, false));
  act(() => result.current("appraisal"));
  await startBackground();
  expect(moduleLoad).not.toHaveBeenCalled(); expect(images).toHaveLength(0);
});

it("does not mount a prepared page after the preloader has been disposed", async () => {
  let loaded!: () => void;
  moduleLoad.mockImplementation(() => new Promise<void>(resolve => { loaded = resolve; }));
  const prepared = vi.fn();
  const view = renderHook(() => useProposalPreload(fixture(), DEFAULT_PROPOSAL_PAGES, true, "property", prepared));
  act(() => view.result.current("appraisal"));
  view.unmount(); await act(async () => loaded());
  expect(prepared).not.toHaveBeenCalled();
});
