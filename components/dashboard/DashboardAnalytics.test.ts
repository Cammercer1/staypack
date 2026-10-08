// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DashboardAnalytics } from "./DashboardAnalytics";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps the latest selected period when an older request finishes late", async () => {
  const pending: Array<(value: Response) => void> = [];
  const fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)));
  vi.stubGlobal("fetch", fetchMock);
  render(createElement(DashboardAnalytics, { activeListings: 3 }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "today" } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => pending[1](Response.json({ views: 120, leads: 12 })));
  expect(screen.getByText("120")).toBeTruthy();
  expect(screen.getByText("10.0%")).toBeTruthy();
  await act(async () => pending[0](Response.json({ views: 999, leads: 99 })));
  expect(screen.queryByText("999")).toBeNull();
  expect(screen.getByText("120")).toBeTruthy();
});

it("waits for both custom dates and Apply before fetching", async () => {
  const fetchMock = vi.fn(async () => Response.json({ views: 20, leads: 2 }));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(createElement(DashboardAnalytics, { activeListings: 3 }));
  await act(async () => {});
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "custom" } });
  const dates = view.container.querySelectorAll('input[type="date"]');
  fireEvent.change(dates[0], { target: { value: "2026-10-01" } });
  fireEvent.change(dates[1], { target: { value: "2026-10-07" } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Apply" })));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1]).toBeTruthy();
});
