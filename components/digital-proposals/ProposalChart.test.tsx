// @vitest-environment jsdom
import { useEffect, type RefObject } from "react";
import type ApexCharts from "apexcharts";
import type { ApexOptions } from "apexcharts";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreparedProposalPage } from "./PreparedProposalPage";
import { useProposalChartMotion } from "./useProposalChartMotion";
import ProposalChart from "./ProposalChart";

const chart = vi.hoisted(() => ({ updateOptions: vi.fn(() => Promise.resolve()), mounts: vi.fn(), animations: false }));
const observers = new Set<IntersectionObserverCallback>();
vi.mock("next/dynamic", () => ({ default: () => function MockChart({ chartRef, options }: {
  chartRef: RefObject<ApexCharts | null>; options: ApexOptions;
}) {
  useEffect(() => {
    chart.mounts();
    chartRef.current = chart as unknown as ApexCharts;
    options.chart?.events?.mounted?.(chartRef.current);
    return () => { chartRef.current = null; };
    // Match the third-party component's mount lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  chart.animations = options.chart?.animations?.enabled === true;
  return <svg data-testid="prepared-chart" />;
} }));

beforeEach(() => {
  chart.updateOptions.mockClear(); chart.mounts.mockClear();
  observers.clear();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const onReady = vi.fn(), onError = vi.fn();
const enterViewport = (intersectionRatio = 1) => act(() => {
  for (const notify of [...observers]) notify([{ isIntersecting: true, intersectionRatio } as IntersectionObserverEntry], {} as IntersectionObserver);
});
function ChartWithMotion({ motion }: { motion: boolean }) {
  const { visible, animate } = useProposalChartMotion(motion);
  return visible && <ProposalChart type="bar" series={[{ data: [10, 20, 30] }]} options={{ chart: { animations: { enabled: animate } } }} />;
}
function Frame({ active, motion = true }: { active: boolean; motion?: boolean }) {
  return <PreparedProposalPage id="appraisal" active={active} motion={motion} onReady={onReady} onError={onError}>
    <ChartWithMotion motion={motion} />
  </PreparedProposalPage>;
}

it("replays a prepared chart on each page entrance without remounting or losing readiness", () => {
  const view = render(<Frame active={false} />);
  const svg = view.container.querySelector("svg");
  expect(svg).not.toBeNull();
  expect(chart.animations).toBe(true);
  expect(chart.updateOptions).not.toHaveBeenCalled();
  expect(view.container.querySelector('[data-proposal-chart="ready"]')).not.toBeNull();
  view.rerender(<Frame active />);
  expect(chart.updateOptions).not.toHaveBeenCalled();
  enterViewport();
  expect(chart.updateOptions).toHaveBeenCalledExactlyOnceWith({}, true, true, false, false);
  expect(view.container.querySelector("svg")).toBe(svg);
  expect(view.container.querySelector('[data-proposal-chart="pending"]')).toBeNull();
  view.rerender(<Frame active />);
  enterViewport();
  expect(chart.updateOptions).toHaveBeenCalledTimes(1);
  view.rerender(<Frame active={false} />);
  enterViewport();
  expect(chart.updateOptions).toHaveBeenCalledTimes(1);
  view.rerender(<Frame active />);
  enterViewport();
  expect(chart.updateOptions).toHaveBeenCalledTimes(2);
  expect(chart.mounts).toHaveBeenCalledTimes(1);
});

it("replays when an initially active page's chart enters the viewport, including below-the-fold charts", () => {
  render(<Frame active />);
  expect(chart.animations).toBe(true);
  expect(chart.mounts).toHaveBeenCalledTimes(1);
  expect(chart.updateOptions).not.toHaveBeenCalled();
  enterViewport(0.1);
  expect(chart.updateOptions).not.toHaveBeenCalled();
  enterViewport();
  expect(chart.updateOptions).toHaveBeenCalledTimes(1);
  enterViewport();
  expect(chart.updateOptions).toHaveBeenCalledTimes(1);
});

it.each(["reduced motion", "brand motion disabled"])("keeps prepared charts still with %s", preference => {
  if (preference === "reduced motion") vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const motion = preference !== "brand motion disabled";
  const view = render(<Frame active={false} motion={motion} />);
  view.rerender(<Frame active motion={motion} />);
  enterViewport();
  expect(chart.animations).toBe(false);
  expect(chart.updateOptions).not.toHaveBeenCalled();
  expect(view.container.querySelector('[data-proposal-chart="ready"]')).not.toBeNull();
});
