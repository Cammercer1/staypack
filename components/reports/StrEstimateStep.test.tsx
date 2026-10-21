// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, fireEvent, render, screen, act, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StrEstimateStep, type StrEstimateHandle } from "./StrEstimateStep";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function showComparables() { fireEvent.click(screen.getByRole("tab", { name: "Comparables" })); }
function openAssumptions() { fireEvent.click(screen.getByRole("button", { name: "Adjust estimate" })); }
function applyAssumptions() { fireEvent.click(screen.getByRole("button", { name: "Apply changes" })); }
it("explains the six-comparable limit at the attempted selection and allows replacing an included property", () => {
  const f = createLintRegressionFixtures();
  const seed = f.report.str_enrichment_json!.comps[0];
  const pool = Array.from({ length: 7 }, (_, index) => ({ ...seed, listing_id: `comparable-${index}`, name: `Comparable ${index + 1}` }));
  const report = { ...f.report, str_enrichment_json: { ...f.report.str_enrichment_json!, comp_pool: pool, comps: pool.slice(0, 6), selected_comp_ids: pool.slice(0, 6).map(comp => comp.listing_id) } };
  render(<StrEstimateStep listing={f.listing} report={report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  showComparables();
  expect(screen.getByText("6 of 6 included")).toBeTruthy();
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(6);
  expect(screen.queryByRole("checkbox", { name: "Feature Comparable 7" })).toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Browse other comparables" }));
  const seventh = screen.getByRole("checkbox", { name: "Feature Comparable 7" });
  fireEvent.click(seventh);
  expect(seventh).toHaveProperty("checked", false);
  const feedback = within(seventh.closest("article")!).getByRole("alert");
  expect(feedback.textContent).toContain("Deselect an included comparable");
  expect(seventh.getAttribute("aria-describedby")).toBe(feedback.id);
  fireEvent.click(screen.getByRole("checkbox", { name: "Feature Comparable 1" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("5 of 6 included")).toBeTruthy();
  fireEvent.click(seventh);
  expect(seventh).toHaveProperty("checked", true);
  expect(screen.getByText("6 of 6 included")).toBeTruthy();
  expect(screen.queryByText(/Selected ·/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show included comparables" }));
  expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(6);
  expect(screen.queryByRole("checkbox", { name: "Feature Comparable 1" })).toBeNull();
  expect(screen.getByRole("checkbox", { name: "Feature Comparable 7" })).toHaveProperty("checked", true);
});

it("opens the comparable choices when none are included and unlocks continuation after selection", () => {
  const f = createLintRegressionFixtures();
  const report = { ...f.report, str_enrichment_json: { ...f.report.str_enrichment_json!, selected_comp_ids: [] } };
  render(<StrEstimateStep listing={f.listing} report={report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByRole("tab", { name: "Estimate" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("alert").textContent).toContain("Select at least one comparable");
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Use this estimate" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Choose comparables" }));
  expect(screen.getByRole("searchbox")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Show included comparables" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Use this estimate" }).every(button => !(button as HTMLButtonElement).disabled)).toBe(true);
});

it("keeps bottom estimate actions in sync with top actions and blocks continuation without evidence", () => {
  const f = createLintRegressionFixtures();
  const onContinue = vi.fn();
  const props = { listing: f.listing, report: f.report, busy: false, onComplete: vi.fn(), onContinue, onBack: vi.fn(), continueLabel: "Use this estimate" };
  const { rerender } = render(<StrEstimateStep {...props} />);
  const bottom = within(screen.getByRole("group", { name: "Estimate step actions" }));
  fireEvent.click(bottom.getByRole("button", { name: "Use this estimate" }));
  expect(onContinue).toHaveBeenCalledTimes(1);
  rerender(<StrEstimateStep {...props} busy />);
  expect(screen.getAllByRole("button", { name: "Use this estimate" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  rerender(<StrEstimateStep {...props} />);
  showComparables();
  screen.getAllByRole("checkbox", { checked: true }).forEach(input => fireEvent.click(input));
  fireEvent.click(screen.getByRole("tab", { name: "Estimate" }));
  expect(screen.getByRole("alert").textContent).toContain("Select at least one comparable");
  expect(screen.getAllByRole("button", { name: "Use this estimate" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
});

it("allows searching the full pool and saves chosen report comps without another estimate request", async () => {
  const f = createLintRegressionFixtures();
  const pool = f.report.str_enrichment_json!.comps;
  const report = { ...f.report, str_enrichment_json: { ...f.report.str_enrichment_json!, provider: "airroi" as const, comp_pool: pool, comps: pool.slice(0, 2), selected_comp_ids: pool.slice(0, 2).map(c => c.listing_id) } };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} listing={f.listing} report={report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /refresh/i })).toBeNull();
  showComparables();
  fireEvent.click(screen.getByRole("checkbox", {name: `Feature ${pool[0].name}`}));
  fireEvent.click(screen.getByRole("button", { name: "Browse other comparables" }));
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

it("keeps invalid estimate guidance reachable from the Comparables section", () => {
  const f = createLintRegressionFixtures();
  const report = { ...f.report, user_overrides_json: { ...f.report.user_overrides_json, strManagement: { unavailableNights: 0, listingStage: "established" as const, rationale: "" } } };
  render(<StrEstimateStep listing={f.listing} report={report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  showComparables();
  expect(screen.getByRole("alert").textContent).toContain("Explain the operating assumptions");
  expect(screen.getAllByRole("button", { name: "Use this estimate" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review estimate" }));
  expect(screen.getByRole("tabpanel", { name: "Estimate" })).toBeTruthy();
  openAssumptions();
  fireEvent.change(screen.getByLabelText(/Basis for your management estimate/), { target: { value: "Reviewed operating assumptions" } });
  applyAssumptions();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Use this estimate" }).every(button => !(button as HTMLButtonElement).disabled)).toBe(true);
});

it("preserves estimate edits, comparable selection and browsing filters across the two sections", async () => {
  const f = createLintRegressionFixtures();
  const pool = f.report.str_enrichment_json!.comps;
  const report = { ...f.report, str_enrichment_json: { ...f.report.str_enrichment_json!, comp_pool: pool, comps: pool.slice(0, 2), selected_comp_ids: pool.slice(0, 2).map(comp => comp.listing_id) } };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} listing={f.listing} report={report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByRole("tabpanel", { name: "Estimate" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Comparable evidence" })).toBeNull();
  openAssumptions();
  fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), { target: { value: "400" } });
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "75" } });
  applyAssumptions();
  showComparables();
  expect(screen.getByRole("tabpanel", { name: "Comparables" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Adjust estimate" })).toBeNull();
  expect(screen.getAllByRole("button", { name: "Use this estimate" })).toHaveLength(2);
  fireEvent.click(screen.getByRole("checkbox", { name: `Feature ${pool[0].name}` }));
  fireEvent.click(screen.getByRole("button", { name: "Browse other comparables" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: pool[3].name } });
  fireEvent.click(screen.getByRole("checkbox", { name: `Feature ${pool[3].name}` }));
  fireEvent.click(screen.getByRole("tab", { name: "Estimate" }));
  openAssumptions();
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "400");
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", "75");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  showComparables();
  expect(screen.getByRole("searchbox")).toHaveProperty("value", pool[3].name);
  expect(screen.getByRole("checkbox", { name: `Feature ${pool[3].name}` })).toHaveProperty("checked", true);
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    selected_comp_listing_ids: [pool[1].listing_id, pool[3].listing_id],
    str_adjustment: { nightlyRate: 400, occupancyRate: 75 },
  });
});

it("previews revenue with either lever, saves only assumptions, and resets without a provider call", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: f.report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), { target: { value: "400" } });
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "75" } });
  expect(screen.getByText("$109,500")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "50" } });
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "400");
  expect(screen.getByText("$73,000")).toBeTruthy();
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ str_adjustment: { mode: "management", nightlyRate: 400, occupancyRate: 50, assumptions: { unavailableNights: 0, listingStage: "established", rationale: "Assumes professional presentation and active pricing, with availability as stated." } } });
  openAssumptions();
  fireEvent.click(screen.getByRole("button", { name: "Reset assumptions" }));
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  // The mock returned the original report, so restoring those same assumptions is a no-op.
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.every(([url]) => url === `/api/reports/${f.report.id}`)).toBe(true);
});

it("rejects empty inputs and allows a zero-occupancy scenario", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: f.report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Apply changes" })).toHaveProperty("disabled", true);
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBeNull(); });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "0" } });
  expect(screen.getByText("$0")).toBeTruthy();
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment.occupancyRate).toBe(0);
});

it("applies a company preset explicitly, saves a report snapshot, and enforces unavailable nights", async () => {
  const f = createLintRegressionFixtures();
  const preset = f.agency.str_management_presets![0];
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: f.report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} agency={f.agency} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  const before = screen.getByLabelText("Average daily rate · ADR ($)").getAttribute("value");
  fireEvent.change(screen.getByLabelText("Use a different preset"), { target: { value: preset.id } });
  expect(screen.getByLabelText("Average daily rate · ADR ($)").getAttribute("value")).toBe(before);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply preset" }));
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "440");
  expect(screen.getByText("$115,632")).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Unavailable nights \/ year/), { target: { value: "200" } });
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBeNull(); });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Unavailable nights \/ year/), { target: { value: "21" } });
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  const saved = JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment;
  expect(saved).toEqual({ mode: "management", nightlyRate: 440, occupancyRate: 72, assumptions: { ...preset.assumptions, presetName: preset.name } });
});

it.each(["Cancel", "Cancel assumption changes", "Escape"])("discards modal drafts with %s while retaining the earlier uplift and precision", async (dismissal) => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} agency={f.agency} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  fireEvent.change(screen.getByLabelText("Management uplift (%)"), { target: { value: "28" } });
  applyAssumptions();
  openAssumptions();
  const originalAdr = (screen.getByLabelText("Average daily rate · ADR ($)") as HTMLInputElement).value;
  const originalOccupancy = (screen.getByLabelText("Estimated occupancy (%)") as HTMLInputElement).value;
  fireEvent.change(screen.getByLabelText("Use a different preset"), { target: { value: f.agency.str_management_presets![0].id } });
  fireEvent.click(screen.getByRole("button", { name: "Apply preset" }));
  fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), { target: { value: "800" } });
  fireEvent.change(screen.getByLabelText(/Basis for your management estimate/), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Apply changes" })).toHaveProperty("disabled", true);
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBeNull(); });
  if (dismissal === "Escape") fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  else fireEvent.click(screen.getByRole("button", { name: dismissal }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByLabelText("Management uplift (%)")).toBeNull();
  expect(screen.getByText("$126,080")).toBeTruthy();
  openAssumptions();
  expect(screen.getByLabelText("Management uplift (%)")).toHaveProperty("value", "28");
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", originalAdr);
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", originalOccupancy);
  expect(screen.getByLabelText("Use a different preset")).toHaveProperty("value", "");
  expect(screen.getByRole("button", { name: "Apply changes" })).toHaveProperty("disabled", false);
  expect(fetcher).not.toHaveBeenCalled();
});

it("filters professionally managed matches from the saved pool without changing report selection or calling an API", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<StrEstimateStep listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  showComparables();
  fireEvent.click(screen.getByRole("button", { name: "Browse other comparables" }));
  const filter = screen.getByRole("button", { name: "Professionally managed (3)" });
  const selectedBefore = screen.getAllByRole("checkbox", { name: /Feature Coastal/, checked: true }).map((input) => input.getAttribute("aria-label"));
  expect(screen.queryByRole("heading", { name: /Professionally managed properties/ })).toBeNull();
  fireEvent.click(filter);
  expect(filter.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getAllByRole("checkbox", { name: /Feature Coastal/ })).toHaveLength(3);
  expect(screen.getByText("3 comparables shown.").getAttribute("role")).toBe("status");
  fireEvent.click(filter);
  expect(filter.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getAllByRole("checkbox", { name: /Feature Coastal/, checked: true }).map((input) => input.getAttribute("aria-label"))).toEqual(selectedBefore);
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps adjustment controls optional and never reapplies changed company defaults to saved figures", async () => {
  const f = createLintRegressionFixtures();
  const report = { ...f.report, user_overrides_json: { strAdjustment: { nightlyRate: 440, occupancyRate: 72 }, strManagement: { unavailableNights: 21, listingStage: "established" as const, rationale: "Already reviewed" } }, final_estimate_json: { ...f.report.final_estimate_json!, nightlyRate: 440, occupancyRate: 72, annualRevenue: 115632 } };
  const props = { agency: f.agency, listing: f.listing, report, busy: false, onComplete: vi.fn(), onContinue: vi.fn(), onBack: vi.fn() };
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  const { rerender } = render(<StrEstimateStep ref={ref} {...props} />);
  expect(screen.getByRole("heading", { name: "Review estimate" })).toBeTruthy();
  expect(screen.getByText("Estimated annual gross STR revenue")).toBeTruthy();
  expect(screen.getByText(DEFAULT_DISCLAIMER)).toBeTruthy();
  expect(screen.queryByLabelText("Management uplift (%)")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Use this estimate" })).toHaveLength(2);
  expect(screen.queryByRole("radiogroup", { name: "Report estimate basis" })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText(/Market benchmark:/)).toBeNull();
  const changed = structuredClone(f.agency);
  changed.str_management_presets!.find((preset) => preset.mode === "relative")!.adrPercent = 100;
  rerender(<StrEstimateStep ref={ref} {...props} agency={changed} />);
  openAssumptions();
  expect(within(screen.getByRole("dialog")).getByText(/Market benchmark:/)).toBeTruthy();
  const upliftHelp = screen.getByText("How uplift works").closest("details")!;
  expect(upliftHelp).toHaveProperty("open", false);
  expect(screen.getByText("Management uplift reflects operating assumptions, not a measured management premium.").closest("details")).toBeNull();
  fireEvent.click(within(upliftHelp).getByText("How uplift works"));
  expect(upliftHelp).toHaveProperty("open", true);
  expect(within(upliftHelp).getByText(/Occupancy is capped by available nights/)).toBeTruthy();
  expect(screen.getByText(/Your management estimate is .* above this benchmark/)).toBeTruthy();
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "440");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBe(report); });
  expect(fetcher).not.toHaveBeenCalled();
});

it("applies a relative preset from the original reference each time, without compounding or a provider call", async () => {
  const f = createLintRegressionFixtures();
  const preset = f.agency.str_management_presets!.find((preset) => preset.mode === "relative")!;
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<StrEstimateStep agency={f.agency} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  fireEvent.change(screen.getByLabelText("Use a different preset"), { target: { value: preset.id } });
  fireEvent.click(screen.getByRole("button", { name: "Apply preset" }));
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "412.29");
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", "77");
  fireEvent.click(screen.getByRole("button", { name: "Apply preset" }));
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "412.29");
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", "77");
  expect(fetcher).not.toHaveBeenCalled();
});

it("restores fractional company defaults exactly and keeps untouched preset precision when editing one lever", async () => {
  const f = createLintRegressionFixtures();
  const baseline = { ...f.report.original_estimate_json!, annualRevenue: 63639, occupancyRate: 56.455430895820236 };
  const expectedAdr = 63639 / (365 * baseline.occupancyRate / 100) * 1.1;
  const expectedOccupancy = baseline.occupancyRate + 5;
  const report = { ...f.report, original_estimate_json: baseline, final_estimate_json: { ...baseline, nightlyRate: 350, occupancyRate: 65, annualRevenue: 83038 }, user_overrides_json: { strAdjustment: { nightlyRate: 350, occupancyRate: 65 } } };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report }));
  vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} agency={f.agency} listing={f.listing} report={report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  fireEvent.click(screen.getByRole("button", { name: "Restore company defaults" }));
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "339.72");
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", "61.46");
  expect(screen.getByText("$76,203")).toBeTruthy();
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment).toMatchObject({ nightlyRate: expectedAdr, occupancyRate: expectedOccupancy });
  openAssumptions();
  fireEvent.click(screen.getByRole("button", { name: "Restore company defaults" }));
  fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), { target: { value: "360" } });
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[1][1].body).str_adjustment).toMatchObject({ nightlyRate: 360, occupancyRate: expectedOccupancy });
  expect(fetcher.mock.calls.every(([url]) => url === `/api/reports/${report.id}`)).toBe(true);
});

it("offers first-appraisal default setup to an admin, previews uplift, and saves settings separately from report figures", async () => {
  const f = createLintRegressionFixtures();
  const agency = { ...f.agency, str_management_presets: [] };
  const baseline = { ...f.report.original_estimate_json!, annualRevenue: 63639, occupancyRate: 56.455430895820236 };
  const report = { ...f.report, original_estimate_json: baseline, final_estimate_json: baseline, final_report_json: null, user_overrides_json: null };
  const changed = vi.fn();
  const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (url) => url === '/api/agencies/str-presets' ? Response.json({ presets: [{ mode: 'uplift', isDefault: true, upliftPercent: 28 }] }) : Response.json({ report }));
  vi.stubGlobal('fetch', fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} agency={agency} listing={f.listing} report={report} canManageDefaults onCompanyPresetsChange={changed} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  expect(screen.queryByText('Set your company’s approach on this first appraisal')).toBeNull();
  openAssumptions();
  expect(screen.getByText('Set your company’s approach on this first appraisal')).toBeTruthy();
  expect(screen.getByLabelText('Management uplift (%)')).toHaveProperty('value', '0');
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  expect(screen.getByText('$81,458')).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 28% as company default' })); });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe('/api/agencies/str-presets');
  expect(changed).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: /as company default/ })).toBeNull();
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const adjustment = JSON.parse((fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).str_adjustment;
  expect(Math.round(adjustment.nightlyRate * adjustment.occupancyRate / 100 * 365)).toBe(81458);
});

it("keeps uplift and granular controls in sync, rejects an empty uplift, and never offers members company setup", async () => {
  const f = createLintRegressionFixtures();
  const agency = { ...f.agency, str_management_presets: [] };
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} agency={agency} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  expect(screen.queryByRole('button', { name: /as company default/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  expect(screen.getByText('$126,080')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Average daily rate · ADR ($)'), { target: { value: '400' } });
  fireEvent.change(screen.getByLabelText('Estimated occupancy (%)'), { target: { value: '75' } });
  expect(screen.getByLabelText('Management uplift (%)')).toHaveProperty('value', '11.17');
  expect(screen.getByText('$109,500')).toBeTruthy();
  applyAssumptions();
  openAssumptions();
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '' } });
  expect(screen.getByRole('button', { name: 'Apply changes' })).toHaveProperty('disabled', true);
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBeNull(); });
  expect(fetcher).not.toHaveBeenCalled();
});

it("leaves first-appraisal figures editable when company setup fails", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'Company settings changed while you were editing.' }, { status: 409 }));
  vi.stubGlobal('fetch', fetcher);
  render(<StrEstimateStep agency={{ ...f.agency, str_management_presets: [] }} canManageDefaults listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 28% as company default' })); });
  expect(screen.getByRole('alert').textContent).toContain('Company settings changed');
  expect(screen.getByLabelText('Management uplift (%)')).toHaveProperty('value', '28');
  expect(screen.getByRole('button', { name: 'Apply changes' })).toHaveProperty('disabled', false);
  applyAssumptions();
  expect(screen.getAllByRole('button', { name: 'Use this estimate' })[0]).toHaveProperty('disabled', false);
});

it("keeps the requested uplift consistent while correcting wording and changing availability", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: f.report })); vi.stubGlobal('fetch', fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} agency={f.agency} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  fireEvent.change(screen.getByLabelText(/Basis for your management estimate/), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText(/Basis for your management estimate/), { target: { value: 'Reviewed company assumptions' } });
  expect(screen.getByText('$126,080')).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Unavailable nights \/ year/), { target: { value: '180' } });
  expect(screen.getByText('$126,080')).toBeTruthy();
  applyAssumptions();
  await act(async () => { await ref.current!.savePendingEdits(); });
  const saved = JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment;
  expect(saved.occupancyRate / 100 * 365).toBeCloseTo(185);
  expect(Math.round(saved.nightlyRate * saved.occupancyRate / 100 * 365)).toBe(126080);
});

it.each([undefined, "market_resolution_failed", "insufficient_data"] as const)("keeps the saved estimate usable when the occupancy benchmark is unavailable for %s", (reason) => {
  const f = createLintRegressionFixtures();
  f.report.str_enrichment_json!.market_occupancy = { status: "unavailable", unavailable_reason: reason, market: null, label: "Market occupancy unavailable", fetched_at: "2026-10-10", request_key: "legacy-failure", cost_cents: 1, filters: {}, sample_count: null, warnings: ["The market location could not be resolved unambiguously."], months: [] };
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<StrEstimateStep listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", String(Math.round(f.report.final_estimate_json!.occupancyRate! * 100) / 100));
  expect(screen.queryByRole("button", { name: /refresh|retry|fetch/i })).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps the saved management estimate when a broader occupancy benchmark is present", () => {
  const f = createLintRegressionFixtures();
  f.report.str_enrichment_json!.market_occupancy = { status: "available", benchmark_scope: "all_property_types", market: { country: "Australia", region: "New South Wales", locality: "Sydney" }, label: "Sydney · 3-bed entire homes · all property types", fetched_at: "2026-10-10", request_key: "broad", cost_cents: 21, filters: {}, sample_count: null, warnings: [], months: [{ month: "2026-09", average: 55, p25: 30, p50: 58, p75: 79, p90: 90 }] };
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<StrEstimateStep listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  openAssumptions();
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", String(Math.round(f.report.final_estimate_json!.occupancyRate! * 100) / 100));
  expect(screen.queryByRole("button", { name: /refresh|retry|fetch/i })).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
