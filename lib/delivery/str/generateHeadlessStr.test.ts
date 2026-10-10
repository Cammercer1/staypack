import { afterEach, expect, it, vi } from "vitest";
import { generateHeadlessStrReport } from "./generateHeadlessStr";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchStrEstimate } from "@/lib/str/estimate";
import { generateReportCopy } from "@/lib/openai/generateReportCopy";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { DeliveryTenant } from "@/lib/delivery/types";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/str/estimate", () => ({ fetchStrEstimate: vi.fn() }));
vi.mock("@/lib/geocoding", () => ({ geocodeReportAddress: vi.fn(async () => ({ latitude: -33.8, longitude: 151.2 })) }));
vi.mock("@/lib/openai/generateReportCopy", () => ({ generateReportCopy: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it.each(["relative", "uplift"] as const)("passes %s company defaults and frozen assumptions into managed delivery copy generation", async (mode) => {
  const f = createLintRegressionFixtures();
  if (mode === "uplift") f.agency.str_management_presets = [{ id: "da8eedcf-4618-4be4-9d34-a8d4f0c07f18", name: "Company uplift", mode: "uplift", isDefault: true, upliftPercent: 28, assumptions: { unavailableNights: 21, listingStage: "established", rationale: "Company assumptions" } }];
  let saved = { ...f.report, original_estimate_json: null, final_estimate_json: null } as typeof f.report;
  const from = (table: string) => {
    const query = {
      insert: vi.fn(() => query),
      update: vi.fn((body) => { if (table === "reports") saved = { ...saved, ...body }; return query; }),
      eq: vi.fn(() => query), select: vi.fn(() => query),
      single: vi.fn(async () => ({ data: table === "reports" ? saved : f.listing, error: null })),
    };
    return query;
  };
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>);
  vi.mocked(fetchStrEstimate).mockResolvedValue({ estimate: f.report.original_estimate_json!, enrichment: f.report.str_enrichment_json! });
  // Stop before the external copy/PDF/publishing stages; this test covers their persisted inputs.
  vi.mocked(generateReportCopy).mockRejectedValue(new Error("stop after estimate"));
  await expect(generateHeadlessStrReport({ tenant: { id: "tenant", slug: "tenant", name: "Tenant", brand: {} } as DeliveryTenant,
    listingUrl: f.listing.listing_url!, parsed: { address: f.listing.property_address ?? undefined, images: [], agents: [], confidence: "high", warnings: [] }, listing: f.listing, agency: f.agency,
    templateIdOverride: "classic-detailed", agentProfile: f.agent, agencyAgents: [f.agent],
  })).rejects.toThrow("stop after estimate");
  expect(fetchStrEstimate).toHaveBeenCalledOnce();
  expect(saved.original_estimate_json!.annualRevenue).toBe(98500);
  expect(saved.final_estimate_json!.annualRevenue).toBe(mode === "uplift" ? 126080 : 115874);
  if (mode === "uplift") expect(saved.user_overrides_json!.strManagement!.presetUpliftPercent).toBe(28);
  else expect(saved.user_overrides_json!.strManagement!.presetAdjustment).toEqual({ adrPercent: 10, occupancyPoints: 5 });
  expect(generateReportCopy).toHaveBeenCalledWith(expect.objectContaining({ estimate: saved.final_estimate_json, report: expect.objectContaining({ user_overrides_json: saved.user_overrides_json }) }));
});
