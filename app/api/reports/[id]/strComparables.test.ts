import { beforeEach, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { Report } from "@/lib/types";
vi.mock("@/lib/str/estimate", () => ({ fetchStrEstimate: vi.fn(() => { throw new Error("No paid estimate call allowed"); }) }));
vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: vi.fn() }));
vi.mock("@/lib/reports/loadReportAgent", () => ({ loadAgencyAgentProfiles: vi.fn(), loadListingAgentProfile: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
function setup(overrides: Partial<Report> = {}) {
  const f = createLintRegressionFixtures();
  let report: Report = { ...f.report, pdf_url: "old.pdf", str_enrichment_json: { ...f.report.str_enrichment_json!, provider: "airroi", comp_pool: f.report.str_enrichment_json!.comps }, ...overrides };
  const update = vi.fn((body: Partial<Report>) => { report = { ...report, ...body }; return query; });
  const query = { update, eq: vi.fn(() => query), select: vi.fn(() => query), single: vi.fn(async () => ({ data: report, error: null })) };
  vi.mocked(requireReportWithListing).mockResolvedValue({ report, listing: f.listing, agency: f.agency, supabase: { from: () => query } } as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  vi.mocked(loadAgencyAgentProfiles).mockResolvedValue([f.agent]);
  vi.mocked(loadListingAgentProfile).mockResolvedValue(f.agent);
  return { f, report, update };
}
it("saves a management scenario and immutable benchmark together without fetching an estimate", async () => {
  const { report, f } = setup();
  const assumptions = { unavailableNights: 30, listingStage: "launch_year", rationale: "Launch rates allow time to build reviews.", presetName: "Apartment launch" };
  const response = await PATCH(new Request("https://example.test/report", { method: "PATCH", body: JSON.stringify({ str_adjustment: { mode: "management", nightlyRate: 330, occupancyRate: 68, assumptions } }) }), { params: Promise.resolve({ id: report.id }) });
  expect(response.status).toBe(200);
  const saved = (await response.json()).report;
  expect(saved.final_estimate_json.annualRevenue).toBe(81906);
  expect(saved.original_estimate_json).toEqual(report.original_estimate_json);
  expect(saved.user_overrides_json.strManagement).toEqual(assumptions);
  expect(saved.final_report_json.str_scenario).toMatchObject({ basis: "management", market_benchmark: { annual_revenue: report.original_estimate_json!.annualRevenue }, management: { ...assumptions, companyName: f.agency.name } });
  expect(saved.pdf_url).toBeNull();
});

it("rejects management occupancy that exceeds available nights before writing", async () => {
  const { report, update } = setup();
  const response = await PATCH(new Request("https://example.test/report", { method: "PATCH", body: JSON.stringify({ str_adjustment: { mode: "management", nightlyRate: 330, occupancyRate: 90, assumptions: { unavailableNights: 100, listingStage: "established", rationale: "Owner use" } } }) }), { params: Promise.resolve({ id: report.id }) });
  expect(response.status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});
it("persists selected IDs in order and the exact same cards in the final report without repricing", async () => {
  const { report, update } = setup();
  const ids = report.str_enrichment_json!.comps.slice(1, 4).reverse().map((c) => c.listing_id);
  const response = await PATCH(new Request("https://example.test/report", { method: "PATCH", body: JSON.stringify({ selected_comp_listing_ids: ids }) }), { params: Promise.resolve({ id: report.id }) });
  expect(response.status).toBe(200);
  const saved = (await response.json()).report;
  expect(saved.str_enrichment_json.selected_comp_ids).toEqual(ids);
  expect(saved.final_report_json.str_enrichment.comps.map((c: {listing_id:string}) => c.listing_id)).toEqual(ids);
  expect(saved.final_estimate_json).toEqual(report.final_estimate_json);
  expect(saved.pdf_url).toBeNull();
  expect(update.mock.calls[0][0]).not.toHaveProperty("selected_comp_listing_ids");
});
it("rejects forged comparable IDs before a database mutation", async () => {
  const { report, update } = setup();
  const response = await PATCH(new Request("https://example.test/report", { method: "PATCH", body: JSON.stringify({ selected_comp_listing_ids: ["other-report-comp"] }) }), { params: Promise.resolve({ id: report.id }) });
  expect(response.status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it("calculates revenue server-side, rebuilds saved-only copy and charts, and keeps source evidence", async () => {
  const f = createLintRegressionFixtures();
  const { report, update } = setup({ ai_copy_json: null, str_enrichment_json: {
    ...f.report.str_enrichment_json!, provider: "airroi", seasonality_basis: "modelled",
    seasonality: Array.from({ length: 12 }, (_, i) => ({ month: String(i), revenue: 5000, revenue_low: null, revenue_high: null, occupancy: null, adr: null, modelled: true })),
  } });
  const response = await PATCH(new Request("https://example.test/report", { method: "PATCH", body: JSON.stringify({ str_adjustment: { mode: "rates", nightlyRate: 400, occupancyRate: 75 } }) }), { params: Promise.resolve({ id: report.id }) });
  expect(response.status).toBe(200);
  const saved = (await response.json()).report;
  expect(saved.final_estimate_json).toMatchObject({ annualRevenue: 109500, nightlyRate: 400, occupancyRate: 75, bookedNights: 274 });
  expect(saved.user_overrides_json.strAdjustment).toEqual({ nightlyRate: 400, occupancyRate: 75 });
  expect(saved.original_estimate_json).toEqual(report.original_estimate_json);
  expect(saved.str_enrichment_json).toEqual(report.str_enrichment_json);
  expect(saved.final_report_json.str.annual_revenue).toBe(109500);
  expect(saved.final_report_json.str_enrichment.seasonality.reduce((sum: number, row: { revenue: number }) => sum + row.revenue, 0)).toBe(109500);
  expect(saved.final_report_json.property.selected_image_urls).toEqual(report.final_report_json!.property.selected_image_urls);
  expect(saved.pdf_url).toBeNull();
  expect(update.mock.calls[0][0]).not.toHaveProperty("str_adjustment");
});
it("resets to the stored market baseline and clears legacy and current revenue overrides", async () => {
  const { report } = setup({ user_overrides_json: { annualRevenue: 120000, strAdjustment: { nightlyRate: 400, occupancyRate: 75 }, estimateInputs: { bedrooms: 3, bathrooms: 2, accommodates: 6 } } });
  const response = await PATCH(new Request("https://example.test/report", { method: "PATCH", body: JSON.stringify({ str_adjustment: { mode: "baseline" } }) }), { params: Promise.resolve({ id: report.id }) });
  expect(response.status).toBe(200);
  const saved = (await response.json()).report;
  expect(saved.final_estimate_json.annualRevenue).toBe(report.original_estimate_json!.annualRevenue);
  expect(saved.user_overrides_json).toEqual({ estimateInputs: { bedrooms: 3, bathrooms: 2, accommodates: 6 } });
});
it.each([
  { str_adjustment: { mode: "rates", nightlyRate: 300, occupancyRate: 101 } },
  { str_adjustment: { mode: "rates", nightlyRate: 300, occupancyRate: 50, annualRevenue: 999999 } },
  { str_adjustment: { mode: "rates", nightlyRate: 300, occupancyRate: 50 }, final_estimate_json: { annualRevenue: 999999 } },
  { str_adjustment: { mode: "baseline" }, user_overrides_json: { annualRevenue: 999999 } },
])("rejects invalid or contradictory figure updates before writing", async (body) => {
  const { report, update } = setup();
  const response = await PATCH(new Request("https://example.test/report", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: report.id }) });
  expect(response.status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});
