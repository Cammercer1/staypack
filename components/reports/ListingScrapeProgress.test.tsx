// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ListingScrapeProgress } from "./ListingScrapeProgress";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("starts at the first step on each import and cancels the previous timers", () => {
  vi.useFakeTimers();
  const view = render(<ListingScrapeProgress active>Listing form</ListingScrapeProgress>);
  expect(screen.getByText("Reading listing URL…")).toBeTruthy();
  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByText("Fetching property data…")).toBeTruthy();
  view.rerender(<ListingScrapeProgress active={false}>Listing form</ListingScrapeProgress>);
  expect(screen.queryByRole("status")).toBeNull();
  act(() => vi.advanceTimersByTime(30000));
  view.rerender(<ListingScrapeProgress active>Listing form</ListingScrapeProgress>);
  expect(screen.getByText("Reading listing URL…")).toBeTruthy();
  act(() => vi.advanceTimersByTime(799));
  expect(screen.getByText("Reading listing URL…")).toBeTruthy();
});
