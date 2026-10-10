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
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ str_adjustment: { mode: "management", nightlyRate: 400, occupancyRate: 50, assumptions: { unavailableNights: 0, listingStage: "established", rationale: "Assumes professional presentation and active pricing, with availability as stated." } } });
  fireEvent.click(screen.getByText("Fine-tune assumptions"));
  fireEvent.click(screen.getByRole("button", { name: "Reset assumptions" }));
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
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "" } });
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBeNull(); });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "0" } });
  expect(screen.getByText("$0")).toBeTruthy();
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
  const before = screen.getByLabelText("Average daily rate · ADR ($)").getAttribute("value");
  fireEvent.click(screen.getByText("Fine-tune assumptions"));
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
  await act(async () => { await ref.current!.savePendingEdits(); });
  const saved = JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment;
  expect(saved).toEqual({ mode: "management", nightlyRate: 440, occupancyRate: 72, assumptions: { ...preset.assumptions, presetName: preset.name } });
});

it("filters professionally managed matches from the saved pool without changing report selection or calling an API", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<StrEstimateStep listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  fireEvent.click(screen.getByLabelText("Show matching professionally managed properties only"));
  expect(screen.getAllByRole("checkbox", { name: /Feature Coastal/ })).toHaveLength(3);
  expect(screen.getByText(/3 with saved annual revenue evidence/)).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});

it("leads with management controls, keeps details collapsed, and never reapplies changed company defaults to saved figures", async () => {
  const f = createLintRegressionFixtures();
  const report = { ...f.report, user_overrides_json: { strAdjustment: { nightlyRate: 440, occupancyRate: 72 }, strManagement: { unavailableNights: 21, listingStage: "established" as const, rationale: "Already reviewed" } }, final_estimate_json: { ...f.report.final_estimate_json!, nightlyRate: 440, occupancyRate: 72, annualRevenue: 115632 } };
  const props = { agency: f.agency, listing: f.listing, report, busy: false, onComplete: vi.fn(), onContinue: vi.fn(), onBack: vi.fn() };
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const ref = createRef<StrEstimateHandle>();
  const { rerender } = render(<StrEstimateStep ref={ref} {...props} />);
  expect(screen.getByRole("heading", { name: "Your management estimate" })).toBeTruthy();
  expect(screen.queryByRole("radiogroup", { name: "Report estimate basis" })).toBeNull();
  expect(screen.getByText("Fine-tune assumptions").closest("details")).toHaveProperty("open", false);
  expect(screen.getByText(/View comparison/).closest("details")).toHaveProperty("open", false);
  const changed = structuredClone(f.agency);
  changed.str_management_presets!.find((preset) => preset.mode === "relative")!.adrPercent = 100;
  rerender(<StrEstimateStep ref={ref} {...props} agency={changed} />);
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "440");
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBe(report); });
  expect(fetcher).not.toHaveBeenCalled();
});

it("applies a relative preset from the original reference each time, without compounding or a provider call", async () => {
  const f = createLintRegressionFixtures();
  const preset = f.agency.str_management_presets!.find((preset) => preset.mode === "relative")!;
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<StrEstimateStep agency={f.agency} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  fireEvent.click(screen.getByText("Fine-tune assumptions"));
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
  fireEvent.click(screen.getByText("Fine-tune assumptions"));
  fireEvent.click(screen.getByRole("button", { name: "Restore company defaults" }));
  expect(screen.getByLabelText("Average daily rate · ADR ($)")).toHaveProperty("value", "339.72");
  expect(screen.getByLabelText("Estimated occupancy (%)")).toHaveProperty("value", "61.46");
  expect(screen.getByText("$76,203")).toBeTruthy();
  await act(async () => { await ref.current!.savePendingEdits(); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment).toMatchObject({ nightlyRate: expectedAdr, occupancyRate: expectedOccupancy });
  fireEvent.click(screen.getByRole("button", { name: "Restore company defaults" }));
  fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), { target: { value: "360" } });
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
  expect(screen.getByText('Set your company’s approach on this first appraisal')).toBeTruthy();
  expect(screen.getByLabelText('Management uplift (%)')).toHaveProperty('value', '0');
  expect(screen.getByLabelText('Average daily rate · ADR ($)').closest('details')).toHaveProperty('open', false);
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  expect(screen.getByText('$81,458')).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 28% as company default' })); });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe('/api/agencies/str-presets');
  expect(changed).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: /as company default/ })).toBeNull();
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
  expect(screen.queryByRole('button', { name: /as company default/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  expect(screen.getByText('$126,080')).toBeTruthy();
  fireEvent.click(screen.getByText('Fine-tune assumptions'));
  fireEvent.change(screen.getByLabelText('Average daily rate · ADR ($)'), { target: { value: '400' } });
  fireEvent.change(screen.getByLabelText('Estimated occupancy (%)'), { target: { value: '75' } });
  expect(screen.getByLabelText('Management uplift (%)')).toHaveProperty('value', '11.17');
  expect(screen.getByText('$109,500')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '' } });
  await act(async () => { expect(await ref.current!.savePendingEdits()).toBeNull(); });
  expect(fetcher).not.toHaveBeenCalled();
});

it("leaves first-appraisal figures editable when company setup fails", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'Company settings changed while you were editing.' }, { status: 409 }));
  vi.stubGlobal('fetch', fetcher);
  render(<StrEstimateStep agency={{ ...f.agency, str_management_presets: [] }} canManageDefaults listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save 28% as company default' })); });
  expect(screen.getByRole('alert').textContent).toContain('Company settings changed');
  expect(screen.getByLabelText('Management uplift (%)')).toHaveProperty('value', '28');
  expect(screen.getByRole('button', { name: /Use figures/ })).toHaveProperty('disabled', false);
});

it("keeps the requested uplift consistent while correcting wording and changing availability", async () => {
  const f = createLintRegressionFixtures();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: f.report })); vi.stubGlobal('fetch', fetcher);
  const ref = createRef<StrEstimateHandle>();
  render(<StrEstimateStep ref={ref} agency={f.agency} listing={f.listing} report={f.report} busy={false} onComplete={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
  fireEvent.click(screen.getByText('Fine-tune assumptions'));
  fireEvent.change(screen.getByLabelText(/Basis for your management estimate/), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Management uplift (%)'), { target: { value: '28' } });
  fireEvent.change(screen.getByLabelText(/Basis for your management estimate/), { target: { value: 'Reviewed company assumptions' } });
  expect(screen.getByText('$126,080')).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Unavailable nights \/ year/), { target: { value: '180' } });
  expect(screen.getByText('$126,080')).toBeTruthy();
  await act(async () => { await ref.current!.savePendingEdits(); });
  const saved = JSON.parse(fetcher.mock.calls[0][1].body).str_adjustment;
  expect(saved.occupancyRate / 100 * 365).toBeCloseTo(185);
  expect(Math.round(saved.nightlyRate * saved.occupancyRate / 100 * 365)).toBe(126080);
});
