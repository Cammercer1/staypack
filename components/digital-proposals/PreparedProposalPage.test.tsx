// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreparedProposalPage } from "./PreparedProposalPage";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); Reflect.deleteProperty(document, "fonts"); });
const advance = (ms = 100) => act(() => vi.advanceTimersByTimeAsync(ms));

it("keeps an offscreen page inert and waits for charts to render before reporting readiness", async () => {
  const ready = vi.fn(), error = vi.fn();
  const props = { id: "forecast", active: false, motion: true, onReady: ready, onError: error };
  const view = render(<PreparedProposalPage {...props}><h1>Forecast</h1><div data-proposal-chart="pending" /></PreparedProposalPage>);
  expect(view.container.firstElementChild?.hasAttribute("inert")).toBe(true);
  expect(view.container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  await advance(); expect(ready).not.toHaveBeenCalled();
  view.rerender(<PreparedProposalPage {...props}><h1>Forecast</h1><div data-proposal-chart="ready"><svg /></div></PreparedProposalPage>);
  await advance(); expect(ready).toHaveBeenCalledExactlyOnceWith("forecast");
  view.rerender(<PreparedProposalPage {...props} active><h1>Forecast</h1><div data-proposal-chart="ready"><svg /></div></PreparedProposalPage>);
  expect(view.container.firstElementChild?.hasAttribute("inert")).toBe(false);
  expect(view.container.firstElementChild?.hasAttribute("aria-hidden")).toBe(false);
  await advance(); expect(ready).toHaveBeenCalledTimes(1);
});

it("bounds waits for stalled photos and fonts without waiting for lazy carousel photos", async () => {
  const ready = vi.fn();
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise(() => {}) } });
  const view = render(<PreparedProposalPage id="evidence" active={false} motion={false} onReady={ready} onError={vi.fn()}>
    {/* eslint-disable-next-line @next/next/no-img-element -- exercise native load/error events */}
    <img src="https://example.com/slow.jpg" alt="Property" />
    {/* eslint-disable-next-line @next/next/no-img-element -- exercise native load/error events */}
    <img loading="lazy" src="https://example.com/later.jpg" alt="Later photo" />
  </PreparedProposalPage>);
  await advance(1600); expect(ready).not.toHaveBeenCalled();
  await advance(300); expect(ready).toHaveBeenCalledExactlyOnceWith("evidence");
  expect(view.container.querySelectorAll("img")).toHaveLength(2);
});

it("does not mark a lazy section ready or report after it unmounts", async () => {
  const ready = vi.fn();
  const view = render(<PreparedProposalPage id="service" active={false} motion={false} onReady={ready} onError={vi.fn()}><div data-proposal-loading /></PreparedProposalPage>);
  await advance(4000); expect(ready).not.toHaveBeenCalled();
  view.unmount(); await advance(4000); expect(ready).not.toHaveBeenCalled();
});
