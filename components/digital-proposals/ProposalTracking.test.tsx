// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRef } from "react";
import { ProposalTracking, useProposalPageTracking, useProposalTracking } from "./ProposalTracking";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function Action() {
  const track = useProposalTracking();
  return <button onClick={() => track("agreement", "contract")}>Agreement</button>;
}
function TrackedPage({ pageId, ready = true }: { pageId: string; ready?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useProposalPageTracking(pageId, root);
  return <div ref={root}><Action />{pageId === "evidence" && ready && <div data-proposal-comparable="0">Comparable</div>}</div>;
}
it("deduplicates a visit, then records a new visit after inactivity", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", request);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  render(<ProposalTracking token="test-link"><TrackedPage pageId="intro" /></ProposalTracking>);
  await act(() => vi.advanceTimersByTimeAsync(700));
  fireEvent.click(screen.getByText("Agreement"));
  fireEvent.click(screen.getByText("Agreement"));
  expect(request).toHaveBeenCalledTimes(3);
  const firstSession = JSON.parse(request.mock.calls[0][1].body).session;
  await act(() => vi.advanceTimersByTimeAsync(31 * 60_000));
  fireEvent(document, new Event("visibilitychange"));
  fireEvent.click(screen.getByText("Agreement"));
  expect(request).toHaveBeenCalledTimes(6);
  expect(JSON.parse(request.mock.calls[3][1].body).session).not.toBe(firstSession);
});
it("tracks client-side page changes once and observes comparables only on the displayed page", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({ ok: true });
  const observe = vi.fn(); const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class { observe = observe; disconnect = disconnect; });
  vi.stubGlobal("fetch", request);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  const view = render(<ProposalTracking token="test-link"><TrackedPage pageId="intro" /></ProposalTracking>);
  await act(() => vi.advanceTimersByTimeAsync(700));
  expect(observe).not.toHaveBeenCalled();
  view.rerender(<ProposalTracking token="test-link"><TrackedPage pageId="evidence" /></ProposalTracking>);
  await act(() => vi.advanceTimersByTimeAsync(700));
  expect(observe).toHaveBeenCalledExactlyOnceWith(screen.getByText("Comparable"));
  view.rerender(<ProposalTracking token="test-link"><TrackedPage pageId="intro" /></ProposalTracking>);
  await act(() => vi.advanceTimersByTimeAsync(700));
  const events = request.mock.calls.map(([, options]) => JSON.parse(options.body));
  expect(events.map(event => [event.kind, event.target])).toEqual([["open", "proposal"], ["page", "intro"], ["page", "evidence"]]);
  expect(new Set(events.map(event => event.session)).size).toBe(1);
  expect(disconnect).toHaveBeenCalledTimes(2);
});
it("does not track actions in an editor or private preview", () => {
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  render(<Action />);
  fireEvent.click(screen.getByText("Agreement"));
  expect(request).not.toHaveBeenCalled();
});

it("observes comparable cards that mount after a lazy section loads without recording preload views", async () => {
  const request = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", request);
  const observe = vi.fn();
  vi.stubGlobal("IntersectionObserver", class { observe = observe; disconnect() {} });
  const view = render(<ProposalTracking token="lazy-link"><TrackedPage pageId="evidence" ready={false} /></ProposalTracking>);
  expect(observe).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  await act(async () => view.rerender(<ProposalTracking token="lazy-link"><TrackedPage pageId="evidence" /></ProposalTracking>));
  expect(observe).toHaveBeenCalledExactlyOnceWith(screen.getByText("Comparable"));
  expect(request).not.toHaveBeenCalled(); // Only visibility or actual viewing should produce events.
});

it("never observes or records comparables in prepared hidden pages", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", request);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  const observe = vi.fn();
  let intersect!: (entries: { isIntersecting: boolean; target: Element }[]) => void;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe = observe; disconnect() {}
  });
  function Pages({ current }: { current: string }) {
    const root = useRef<HTMLDivElement>(null); useProposalPageTracking(current, root);
    return <div ref={root}><div data-proposal-page="property" aria-hidden={current !== "property" || undefined}>Cover</div>
      <div data-proposal-page="evidence" aria-hidden={current !== "evidence" || undefined}><div data-proposal-comparable="0">Prepared comparable</div></div></div>;
  }
  const view = render(<ProposalTracking token="prepared-link"><Pages current="property" /></ProposalTracking>);
  await act(() => vi.advanceTimersByTimeAsync(700));
  expect(observe).not.toHaveBeenCalled();
  const card = screen.getByText("Prepared comparable");
  act(() => intersect([{ isIntersecting: true, target: card }]));
  expect(request.mock.calls.map(([, options]) => JSON.parse(options.body).kind)).toEqual(["open", "page"]);
  view.rerender(<ProposalTracking token="prepared-link"><Pages current="evidence" /></ProposalTracking>);
  expect(observe).toHaveBeenCalledExactlyOnceWith(card);
  act(() => intersect([{ isIntersecting: true, target: card }]));
  expect(JSON.parse(request.mock.calls.at(-1)![1].body)).toMatchObject({ kind: "comparable", target: "0" });
});
