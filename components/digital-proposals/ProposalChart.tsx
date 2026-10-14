"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import type ApexCharts from "apexcharts";
import type { ApexOptions } from "apexcharts";
import { usePreparedProposalPage, useProposalPageVisible } from "./PreparedProposalPage";

/** Both charts and the proposal preloader use the same cached browser module. */
export const preloadProposalCharts = () => import("react-apexcharts");
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
export default function ProposalChart(props: ComponentProps<typeof Chart>) {
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const internalChartRef = useRef<ApexCharts | null>(null);
  const chartRef = props.chartRef ?? internalChartRef;
  const prepared = usePreparedProposalPage();
  const visible = useProposalPageVisible();
  const animate = props.options?.chart?.animations?.enabled === true;
  const options = useMemo<ApexOptions>(() => ({ ...props.options, chart: { ...props.options?.chart,
    events: { ...props.options?.chart?.events, mounted: (chart, config) => {
      setReady(true); props.options?.chart?.events?.mounted?.(chart, config);
    } },
  } }), [props.options]);

  useEffect(() => {
    if (!ready || !prepared || !visible || !animate || !root.current) return;
    let disposed = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (disposed || !entry.isIntersecting || entry.intersectionRatio < 0.25) return;
      observer.disconnect();
      // Replay Apex's entrance from its already-loaded data. Keep the chart
      // mounted and ready: page navigation must never return to a loading state.
      // redrawPaths=true replays the initial bar/line animation, not a data morph.
      void chartRef.current?.updateOptions({}, true, true, false, false).catch(() => {});
    }, { threshold: 0.25, rootMargin: "0px 0px -80px 0px" });
    observer.observe(root.current);
    return () => { disposed = true; observer.disconnect(); };
  }, [ready, prepared, visible, animate, chartRef]);

  return <div ref={root} data-proposal-chart={ready ? "ready" : "pending"}><Chart {...props} chartRef={chartRef} options={options} /></div>;
}
