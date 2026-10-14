// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProposalData } from "@/lib/digital-proposals/data";
import { ComparableListings } from "./ComparableListings";

let resize: () => void;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const listings: ProposalData["comparables"] = Array.from({ length: 6 }, (_, index) => ({
  name: `Coastal apartment ${index + 1}`, bedrooms: 2, annualRevenue: 60000 + index, distanceM: 100, imageUrl: "",
}));

// Supply browser geometry so tests cover scroll bounds, swipes and responsive counters.
function geometry(track: HTMLElement, visible = 1) {
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: visible * 320 - 20 },
    scrollWidth: { configurable: true, value: 1900 },
  });
  Array.from(track.children).forEach((child, index) => Object.defineProperties(child, {
    offsetLeft: { configurable: true, value: index * 320 }, offsetWidth: { configurable: true, value: 300 },
  }));
  track.scrollTo = vi.fn(options => {
    track.scrollLeft = (options as ScrollToOptions).left ?? 0;
    fireEvent.scroll(track);
  });
  act(() => resize());
}

it("navigates all six listings by buttons and keyboard, respects bounds, and updates after a swipe", () => {
  render(<ComparableListings comparables={listings} motion={false} />);
  const track = screen.getByRole("region", { name: "Comparable listings" });
  geometry(track);
  const previous = screen.getByRole("button", { name: "Previous comparable" }) as HTMLButtonElement;
  const next = screen.getByRole("button", { name: "Next comparable" }) as HTMLButtonElement;
  expect(previous.disabled).toBe(true);
  for (let index = 2; index <= 6; index++) {
    fireEvent.click(next);
    expect(screen.getByRole("status").textContent).toBe(`Listings ${index} of 6`);
  }
  expect(next.disabled).toBe(true);
  fireEvent.keyDown(track, { key: "Home" });
  expect(previous.disabled).toBe(true);
  fireEvent.keyDown(track, { key: "ArrowRight" });
  expect(screen.getByRole("status").textContent).toBe("Listings 2 of 6");
  track.scrollLeft = 960;
  fireEvent.scroll(track);
  expect(screen.getByRole("status").textContent).toBe("Listings 4 of 6");
  fireEvent.keyDown(track, { key: "End" });
  fireEvent.keyDown(track, { key: "ArrowLeft" });
  expect(screen.getByRole("status").textContent).toBe("Listings 5 of 6");
});

it.each([2, 3] as const)("shows %i listings on wider screens and recalculates controls after resizing", visible => {
  render(<ComparableListings comparables={listings} motion maxVisible={visible} />);
  const track = screen.getByRole("region", { name: "Comparable listings" });
  geometry(track, visible);
  expect(screen.getByRole("status").textContent).toBe(`Listings 1–${visible} of 6`);
  fireEvent.keyDown(track, { key: "End" });
  expect(screen.getByRole("status").textContent).toBe(`Listings ${7 - visible}–6 of 6`);
  expect((screen.getByRole("button", { name: "Next comparable" }) as HTMLButtonElement).disabled).toBe(true);
  geometry(track, 1);
  expect(screen.getByRole("status").textContent).toBe(`Listings ${7 - visible} of 6`);
  expect((screen.getByRole("button", { name: "Next comparable" }) as HTMLButtonElement).disabled).toBe(false);
});

it("handles missing listing data and hides controls for a single listing", () => {
  render(<ComparableListings comparables={[{ ...listings[0], annualRevenue: null, bedrooms: null, distanceM: null }]} motion={false} />);
  expect(screen.queryByRole("button", { name: "Next comparable" })).toBeNull();
  expect(screen.getByText("Not available")).toBeTruthy();
  expect(screen.getByText("Photo unavailable")).toBeTruthy();
});

it("does not show carousel controls for an empty selection", () => {
  render(<ComparableListings comparables={[]} motion={false} />);
  expect(screen.getByText("No comparable listings included.")).toBeTruthy();
  expect(screen.queryByRole("region")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
