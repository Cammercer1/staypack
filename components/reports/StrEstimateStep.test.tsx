// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StrEstimateStep, type StrEstimateHandle } from "./StrEstimateStep";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("allows searching the full pool and saves chosen report comps without another estimate request", async () => {
  const f = createLintRegressionFixtures();
  const pool = f.report.str_enrichment_json!.comps;
  const report = { ...f.report, str_enrichment_json: { ...f.report.str_enrichment_json!, provider: "airroi" as const, comp_pool: pool, comps: pool.slice(0, 2), selected_comp_ids: pool.slice(0, 2).map(c => c.listing_id) } };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} listing={f.listing} report={report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /refresh/i })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", {name: `Feature ${pool[0].name}`}));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: pool[3].name } });
  fireEvent.click(screen.getByRole("checkbox", {name: `Feature ${pool[3].name}`}));
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe(`/api/reports/${report.id}`);
  const body = JSON.parse(init.body);
  expect(body.selected_comp_listing_ids).toEqual([pool[1].listing_id, pool[3].listing_id]);
  expect(body).not.toHaveProperty("final_estimate_json");
  expect(body).not.toHaveProperty("str_adjustment");
  expect(body).not.toHaveProperty("user_overrides_json");
});

it("previews revenue with either lever, saves only assumptions, and resets without a provider call", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: f.report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), { target: { value: "400" } });
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "75" } });
  expect(screen.getByText("$109,500")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "50" } });
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "400");
  expect(screen.getByText("$73,000")).toBeTruthy();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ str_adjustment: { mode: "rates", nightlyRate: 400, occupancyRate: 50 } });
  fireEvent.click(screen.getByRole("button", { name: "Reset to market baseline" }));
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ str_adjustment: { mode: "baseline" } });
  expect(fetcher.mock.calls.every(([url]) => url === `/api/reports/${f.report.id}`)).toBe(true);
});

it("rejects empty inputs and allows a zero-occupancy scenario", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: f.report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "" } });
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBeNull(); });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "0" } });
  expect(screen.getByText("$0")).toBeTruthy();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment.occupancyRate).toBe(0);
});
