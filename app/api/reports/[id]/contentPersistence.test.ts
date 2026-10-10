import { afterEach, describe, expect, it, vi } from "vitest";
import { PATCH as saveReport } from "./route";
import { PATCH as saveCopy } from "./str-report-copy/route";
import { POST as generateCopy } from "./generate-copy/route";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import {
  loadAgencyAgentProfiles,
  loadListingAgentProfile,
} from "@/lib/reports/loadReportAgent";
import { generateReportCopy } from "@/lib/openai/generateReportCopy";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { Report } from "@/lib/types";

vi.mock("@/lib/auth/requireUser", () => ({
  requireReportWithListing: vi.fn(),
}));
vi.mock("@/lib/templates/grants/assertTemplateGranted", () => ({
  assertTemplateGranted: vi.fn(),
}));
vi.mock("@/lib/reports/loadReportAgent", () => ({
  loadAgencyAgentProfiles: vi.fn(),
  loadListingAgentProfile: vi.fn(),
}));
vi.mock("@/lib/openai/generateReportCopy", () => ({
  generateReportCopy: vi.fn(),
  CopyOpenAIError: class extends Error {},
  CopyValidationError: class extends Error {},
}));
afterEach(() => vi.clearAllMocks());
function setup() {
  const { report, listing, agency, agent } = createLintRegressionFixtures();
  let current: Report = {
    ...report,
    status: "published",
    pdf_url: "old.pdf",
    final_report_json: {
      ...report.final_report_json!,
      document_link: { mode: "custom", url: "https://example.test/agent" },
      assets: { qr_code_url: "qr", pdf_url: "old.pdf" },
    },
  };
  const query = {
    update: vi.fn((body: Partial<Report>) => {
      current = { ...current, ...body };
      return query;
    }),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => ({ data: current, error: null })),
  };
  vi.mocked(requireReportWithListing).mockImplementation(
    async () =>
      ({
        report: current,
        listing,
        agency,
        supabase: { from: () => query },
      }) as unknown as Awaited<ReturnType<typeof requireReportWithListing>>,
  );
  vi.mocked(loadAgencyAgentProfiles).mockResolvedValue([agent]);
  vi.mocked(loadListingAgentProfile).mockResolvedValue(agent);
  vi.mocked(generateReportCopy).mockResolvedValue(report.ai_copy_json!);
  return { report: current, getReport: () => current, query };
}
const request = (body: unknown) =>
  new Request("https://example.test/report", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
const params = { params: Promise.resolve({ id: "mock-report" }) };
describe("STR content persistence", () => {
  for (const action of [
    "wording",
    "estimate",
    "template",
    "regenerate",
  ] as const) {
    it(`invalidates stale PDF after ${action} changes, keeping photos and link choices`, async () => {
      const { report, getReport } = setup();
      const response =
        action === "wording"
          ? await saveCopy(
              request({
                copy: {
                  ...report.final_report_json!.copy,
                  heading: "Reviewed report",
                },
              }),
              params,
            )
          : action === "estimate"
            ? await saveReport(
                request({
                  final_estimate_json: {
                    ...report.final_estimate_json,
                    annualRevenue: 120000,
                  },
                }),
                params,
              )
            : action === "template"
              ? await saveReport(
                  request({ template_id: "bold-detailed" }),
                  params,
                )
              : await generateCopy(request({}), params);
      expect(response.status).toBe(200);
      expect(getReport().pdf_url).toBeNull();
      expect(getReport().final_report_json?.assets.pdf_url).toBe("");
      expect(getReport().final_report_json?.property.hero_image_url).toBe(
        report.final_report_json?.property.hero_image_url,
      );
      expect(getReport().final_report_json?.document_link).toEqual(
        report.final_report_json?.document_link,
      );
      expect(getReport().status).toBe("published");
    });
  }
  it("keeps the PDF for a metadata-only change", async () => {
    const { getReport } = setup();
    expect(
      (await saveReport(request({ user_overrides_json: {} }), params)).status,
    ).toBe(200);
    expect(getReport().pdf_url).toBe("old.pdf");
  });
});
