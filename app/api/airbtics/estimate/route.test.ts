import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { fetchStrEstimate } from "@/lib/str/estimate";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: vi.fn() }));
vi.mock("@/lib/geocoding", () => ({ geocodeReportAddress: vi.fn(async () => ({ latitude: -33.91, longitude: 151.22, formattedAddress: "Test property" })) }));
vi.mock("@/lib/str/estimate", () => ({ fetchStrEstimate: vi.fn() }));
vi.mock("@/lib/reports/loadReportAgent", () => ({ loadAgencyAgentProfiles: vi.fn(), loadListingAgentProfile: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it.each(([null, "summary", "full"] as const).flatMap((tier) => [false, true].map((adjusted) => ({ tier, adjusted }))))("saves AirROI without losing report settings on old and migrated schemas (tier=$tier, adjusted=$adjusted)", async ({ tier, adjusted }) => {
  const fixtures = createLintRegressionFixtures();
  let report = { ...fixtures.report, airbtics_tier: tier, pdf_url: "old.pdf", status: "published" as typeof fixtures.report.status };
  const rates = { nightlyRate: 320, occupancyRate: 65 };
  report.user_overrides_json = adjusted ? { strAdjustment: rates } : null;
  report.str_enrichment_json = { ...report.str_enrichment_json!, selected_comp_ids: [report.str_enrichment_json!.comps[1].listing_id] };
  let listing = fixtures.listing;
  report.final_report_json = { ...report.final_report_json!, document_link: { mode: "custom", url: "https://example.test/agent" } };
  const nextEstimate = { ...report.final_estimate_json!, annualRevenue: 130000 };
  function from(table: string) {
    let error: { message: string } | null = null;
    const query = {
      update: vi.fn((body: Record<string, unknown>) => {
        if (table === "reports") {
          if (tier !== null && body.airbtics_tier === null) {
            error = { message: 'null value in column "airbtics_tier" of relation "reports" violates not-null constraint' };
          } else {
            report = { ...report, ...body };
          }
        } else {
          listing = { ...listing, ...body };
        }
        return query;
      }),
      eq: vi.fn(() => query), select: vi.fn(() => query),
      single: vi.fn(async () => ({ data: error ? null : table === "reports" ? report : listing, error })),
    };
    return query;
  }
  vi.mocked(requireReportWithListing).mockResolvedValue({ report, listing, agency: fixtures.agency, supabase: { from } } as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  vi.mocked(fetchStrEstimate).mockResolvedValue({ estimate: nextEstimate, enrichment: { ...fixtures.report.str_enrichment_json!, provider: "airroi", fetched_at: "2026-10-10T00:00:00Z" } });
  vi.mocked(loadAgencyAgentProfiles).mockResolvedValue([fixtures.agent]);
  vi.mocked(loadListingAgentProfile).mockResolvedValue(fixtures.agent);
  const response = await POST(new Request("https://example.test/estimate", { method: "POST", body: JSON.stringify({ report_id: "b7067c85-6745-48c7-a9f8-e48cdb91d854", bedrooms: 3, bathrooms: 2, accommodates: 6 }) }));
  expect(response.status).toBe(200);
  const saved = (await response.json()).report;
  expect(saved.airbtics_tier).toBe(tier);
  expect(saved.str_enrichment_json.provider).toBe("airroi");
  expect(fetchStrEstimate).toHaveBeenCalledOnce();
  expect(saved.pdf_url).toBeNull();
  expect(saved.final_report_json.assets.pdf_url).toBe("");
  expect(saved.original_estimate_json.annualRevenue).toBe(130000);
  expect(saved.final_report_json.str_scenario.market_benchmark.annual_revenue).toBe(130000);
  expect(saved.final_report_json.str.annual_revenue).toBe(adjusted ? 75920 : 130000);
  expect(saved.user_overrides_json.strAdjustment).toEqual(adjusted ? rates : undefined);
  expect(saved.str_enrichment_json.selected_comp_ids).toEqual(report.str_enrichment_json!.selected_comp_ids);
  expect(saved.final_report_json.property.hero_image_url).toBe(fixtures.report.final_report_json?.property.hero_image_url);
  expect(saved.final_report_json.copy.heading).toBe(fixtures.report.final_report_json?.copy.heading);
  expect(saved.final_report_json.document_link).toEqual({ mode: "custom", url: "https://example.test/agent" });
  expect(saved.user_overrides_json.estimateInputs).toEqual({ bedrooms: 3, bathrooms: 2, accommodates: 6 });
  expect(saved.status).toBe("published");
});

it.each(["relative", "uplift"] as const)("applies %s company defaults once and retains the report snapshot after company settings change", async (mode) => {
  const f = createLintRegressionFixtures();
  const agency = structuredClone(f.agency);
  if (mode === "uplift") agency.str_management_presets = [{ id: "da8eedcf-4618-4be4-9d34-a8d4f0c07f18", name: "Company uplift", mode: "uplift", isDefault: true, upliftPercent: 28, assumptions: { unavailableNights: 21, listingStage: "established", rationale: "Company assumptions" } }];
  let report: typeof f.report = { ...f.report, original_estimate_json: null, final_estimate_json: null, final_report_json: null, ai_copy_json: null, user_overrides_json: null, status: "draft" };
  const from = (table: string) => {
    const query = {
      update: vi.fn((body) => { if (table === "reports") report = { ...report, ...body }; return query; }),
      eq: vi.fn(() => query), select: vi.fn(() => query),
      single: vi.fn(async () => ({ data: table === "reports" ? report : f.listing, error: null })),
    };
    return query;
  };
  vi.mocked(requireReportWithListing).mockImplementation(async () => ({ report, listing: f.listing, agency, supabase: { from } }) as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  vi.mocked(fetchStrEstimate).mockResolvedValue({ estimate: f.report.original_estimate_json!, enrichment: f.report.str_enrichment_json! });
  vi.mocked(loadAgencyAgentProfiles).mockResolvedValue([f.agent]);
  vi.mocked(loadListingAgentProfile).mockResolvedValue(f.agent);
  const request = () => new Request("https://example.test/estimate", { method: "POST", body: JSON.stringify({ report_id: "b7067c85-6745-48c7-a9f8-e48cdb91d854", bedrooms: 4, bathrooms: 2, accommodates: 8 }) });
  expect((await POST(request())).status).toBe(200);
  expect(fetchStrEstimate).toHaveBeenCalledOnce();
  const savedRates = structuredClone(report.user_overrides_json!.strAdjustment!);
  const savedAssumptions = structuredClone(report.user_overrides_json!.strManagement!);
  expect(savedRates.occupancyRate).toBeCloseTo(mode === "uplift" ? 72 * Math.sqrt(1.28) : 77);
  expect(savedRates.nightlyRate).toBeCloseTo(98500 / (365 * 0.72) * (mode === "uplift" ? Math.sqrt(1.28) : 1.1));
  if (mode === "uplift") {
    expect(report.final_estimate_json!.annualRevenue).toBe(126080);
    expect(savedAssumptions.presetUpliftPercent).toBe(28);
  } else expect(savedAssumptions.presetAdjustment).toEqual({ adrPercent: 10, occupancyPoints: 5 });
  expect(report.original_estimate_json!.annualRevenue).toBe(98500);
  const companyDefault = agency.str_management_presets!.find((preset) => preset.isDefault)!;
  if (companyDefault.mode === "uplift") companyDefault.upliftPercent = 100;
  if (companyDefault.mode === "relative") companyDefault.adrPercent = 100;
  companyDefault.assumptions.rationale = "Changed company assumptions";
  report.ai_copy_json = f.report.ai_copy_json;
  vi.mocked(fetchStrEstimate).mockResolvedValue({ estimate: { ...f.report.original_estimate_json!, annualRevenue: 150000 }, enrichment: f.report.str_enrichment_json! });
  expect((await POST(request())).status).toBe(200);
  expect(report.user_overrides_json!.strAdjustment).toEqual(savedRates);
  expect(report.user_overrides_json!.strManagement).toEqual(savedAssumptions);
  expect(report.final_report_json!.str_scenario!.management).toMatchObject(savedAssumptions);
  expect(report.final_report_json!.str_scenario!.market_benchmark.annual_revenue).toBe(150000);
});
