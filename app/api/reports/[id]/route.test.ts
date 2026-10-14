import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { PATCH } from "./route";
import type { Report } from "@/lib/types";
vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: vi.fn() }));
vi.mock("@/lib/reports/loadReportAgent", () => ({ loadListingAgentProfile: vi.fn(async () => null), loadAgencyAgentProfiles: vi.fn(async () => []) }));
vi.mock("@/lib/templates/grants/assertTemplateGranted", () => ({ assertTemplateGranted: vi.fn() }));
afterEach(() => vi.resetAllMocks());
function setup(draft = false) {
  const { listing, agency, report } = createLintRegressionFixtures();
  report.user_overrides_json = { strAdjustment: { nightlyRate: 450, occupancyRate: 70 }, estimateInputs: { bedrooms: 4, bathrooms: 2, accommodates: 8 } };
  if (draft) { report.final_estimate_json = null; report.original_estimate_json = null; report.final_report_json = null; report.ai_copy_json = null; }
  let written: Partial<Report> = {};
  const query = { update: vi.fn((data: Partial<Report>) => { written = data; return query; }), eq: vi.fn(() => query), select: vi.fn(() => query), single: vi.fn(async () => ({ data: { ...report, ...written }, error: null })) };
  vi.mocked(requireReportWithListing).mockResolvedValue({ report, listing, agency, supabase: { from: () => query } } as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  const request = (body: unknown) => PATCH(new Request("http://localhost/api/report", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: report.id }) });
  return { report, query, request };
}
const context = { propertyValue: 1200000, weeklyRent: 950, amenities: ["pool"], additionalAmenities: ["Tennis court"] };
it("merges property context without losing rate assumptions, rebuilds LTR and invalidates the PDF", async () => {
  const { report, request } = setup();
  const response = await request({ str_property: context });
  expect(response.status).toBe(200);
  const saved = (await response.json()).report;
  expect(saved.user_overrides_json).toEqual({ ...report.user_overrides_json, strProperty: context });
  expect(saved.final_report_json.ltr.annual_midpoint).toBe(49400);
  expect(saved.final_report_json.property.estimated_value).toBe(1200000);
  expect(saved.final_report_json.str_yield.price_midpoint).toBe(1200000);
  expect(saved.final_estimate_json).toEqual(report.final_estimate_json);
  expect(saved.final_report_json.property.amenities).toEqual(["Pool", "Tennis court"]);
  expect(saved.pdf_url).toBeNull();
});
it("saves a draft's property context before an estimate exists", async () => {
  const { request } = setup(true);
  const response = await request({ str_property: context });
  expect(response.status).toBe(200);
  const saved = (await response.json()).report;
  expect(saved.user_overrides_json.strProperty).toEqual(context);
  expect(saved.final_report_json).toBeNull();
});
it("rejects invalid rental figures and conflicting override writes before persistence", async () => {
  const { request, query } = setup();
  expect((await request({ str_property: { ...context, weeklyRent: -100 } })).status).toBe(400);
  expect((await request({ str_property: context, user_overrides_json: { strAdjustment: { nightlyRate: 300, occupancyRate: 60 } } })).status).toBe(400);
  expect(query.update).not.toHaveBeenCalled();
});
