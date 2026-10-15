import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { publishedReportSnapshot } from "@/lib/reports/publicationSnapshot";
import type { FinalReportJson, Report } from "@/lib/types";
const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: mocks.access }));
vi.mock("@/lib/templates/grants/assertTemplateGranted", () => ({ assertTemplateGranted: vi.fn() }));
vi.mock("@/lib/reports/loadReportAgent", () => ({ loadListingAgentProfile: async () => null, loadAgencyAgentProfiles: async () => [] }));
vi.mock("@/lib/lease-appraisal/rebuildLeaseAppraisalReport", () => ({ rebuildLeaseAppraisalFinalReport: ({ report, copy }: { report: Report; copy: FinalReportJson["copy"] }) => ({ ...report.final_report_json, copy }) }));
vi.mock("@/lib/sales-appraisal/rebuildSalesAppraisalReport", () => ({ rebuildSalesAppraisalFinalReport: ({ report, copy }: { report: Report; copy: FinalReportJson["copy"] }) => ({ ...report.final_report_json, copy }) }));
import { PATCH as saveRental } from "./lease-appraisal-copy/route";
import { PATCH as saveSales } from "./sales-appraisal-copy/route";
import { POST as publish } from "./publish/route";
beforeEach(() => vi.clearAllMocks());

describe.each([
  ["rental", "classic-lease-appraisal", saveRental],
  ["sales", "classic-sales-appraisal", saveSales],
] as const)("%s draft publication", (_name, template, save) => {
  it("does not change the public report on Save & preview; explicit publication promotes it", async () => {
    const fixture = createLintRegressionFixtures();
    let current: Report = { ...fixture.report, template_id: template, status: "published" };
    const original = current.final_report_json!;
    const query = {
      update: (body: Partial<Report>) => { current = { ...current, ...body }; return query; },
      eq: () => query,
      select: () => query,
      single: async () => ({ data: current, error: null }),
    };
    mocks.access.mockImplementation(async () => ({ ...fixture, report: current, supabase: { from: () => query } }));
    const request = (body: unknown) => new Request("https://example.test", { method: "PATCH", body: JSON.stringify(body) });
    const params = { params: Promise.resolve({ id: current.id }) };
    for (const heading of ["Draft one", "Draft two"]) {
      const result = await save(request({ copy: { ...original.copy, heading }, template_id: template }), params);
      expect(result.status).toBe(200);
      expect(current.final_report_json?.copy.heading).toBe(heading);
      expect(publishedReportSnapshot(current.final_report_json!)).toEqual(original);
    }
    expect((await publish(request({}), params)).status).toBe(200);
    expect(current.final_report_json?.published_report_json).toBeUndefined();
    expect(publishedReportSnapshot(current.final_report_json!).copy.heading).toBe("Draft two");
  });
});

it("rejects a stale publication without marking collateral as published", async () => {
  const fixture = createLintRegressionFixtures();
  const query = {
    update: vi.fn(() => query), eq: vi.fn(() => query), select: vi.fn(() => query),
    single: vi.fn(async () => ({ data: null, error: { code: "PGRST116", message: "No matching version" } })),
  };
  const from = vi.fn(() => query);
  mocks.access.mockResolvedValue({ ...fixture, supabase: { from } });
  const response = await publish(new Request("https://example.test", { method: "POST" }), { params: Promise.resolve({ id: fixture.report.id }) });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: expect.stringContaining("report changed") });
  expect(query.eq).toHaveBeenCalledWith("updated_at", fixture.report.updated_at);
  expect(from).toHaveBeenCalledExactlyOnceWith("reports");
});
