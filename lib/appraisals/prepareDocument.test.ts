import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { FinalReportJson } from "@/lib/types";
import type { WorkspaceAppraisal } from "./workspaceTypes";

const mocks = vi.hoisted(() => ({ access: vi.fn(), agents: vi.fn(), leaseCopy: vi.fn(), salesCopy: vi.fn(), rpc: vi.fn(), from: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: vi.fn() }));
vi.mock("@/lib/reports/loadReportAgent", () => ({ loadAgencyAgentProfiles: mocks.agents }));
vi.mock("@/lib/openai/generateLeaseAppraisalCopy", () => ({ generateLeaseAppraisalCopy: mocks.leaseCopy }));
vi.mock("@/lib/openai/generateSalesAppraisalCopy", () => ({ generateSalesAppraisalCopy: mocks.salesCopy }));
vi.mock("./workspace", async importOriginal => ({ ...await importOriginal<typeof import("./workspace")>(), requireAppraisalAccess: mocks.access }));
import { prepareAppraisalDocument } from "./prepareDocument";
import { POST } from "@/app/api/appraisals/[reportId]/prepare/route";

type Context = Parameters<typeof prepareAppraisalDocument>[0];
const reportId = "10000000-0000-4000-8000-000000000001";
const expected = "2026-10-16T00:00:00.000Z";

function context(kind: "lease" | "sales"): Context {
  const fixture = createLintRegressionFixtures();
  const report = { ...fixture[kind], id: reportId, status: "published" as const, pdf_url: "https://example.test/preserved.pdf" };
  const appraisal: WorkspaceAppraisal = { ...fixture.appraisal, report_id: reportId, kind, updated_at: expected,
    inputs_json: { version: 1, listing: structuredClone(fixture.listing) }, input_revision: 3, document_revision: 3,
    document_json: structuredClone(report.final_report_json) };
  appraisal.document_json!.copy.heading = "Previous editable wording";
  const result = { agency: fixture.agency, listing: fixture.listing, workingListing: structuredClone(fixture.listing), report, appraisal,
    supabase: { rpc: mocks.rpc, from: mocks.from } } as unknown as Context;
  mocks.access.mockResolvedValue(result);
  mocks.agents.mockResolvedValue([fixture.agent]);
  mocks.rpc.mockImplementation(async (_name: string, args: { p_document: FinalReportJson }) => ({ error: null,
    data: { ...appraisal, updated_at: "2026-10-16T00:01:00.000Z", document_revision: appraisal.input_revision, document_json: args.p_document } }));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leaseCopy.mockResolvedValue(undefined);
  mocks.salesCopy.mockResolvedValue(undefined);
  mocks.fetch.mockRejectedValue(new Error("External provider calls are forbidden in this test"));
  mocks.from.mockImplementation(() => { throw new Error("Direct table writes are forbidden in this test"); });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

function expectNoWork() {
  expect(mocks.agents).not.toHaveBeenCalled();
  expect(mocks.leaseCopy).not.toHaveBeenCalled();
  expect(mocks.salesCopy).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
}

describe.each(["lease", "sales"] as const)("%s proposal preparation", kind => {
  it("refreshes current editable wording from saved evidence without provider calls or publication writes", async () => {
    const ctx = context(kind);
    const before = structuredClone({ appraisal: ctx.appraisal, listing: ctx.listing, workingListing: ctx.workingListing, report: ctx.report });
    const result = await prepareAppraisalDocument(ctx, expected, { refreshCopy: true });
    expect(result.document_json!.copy.heading).not.toBe("Previous editable wording");
    expect(result.document_json!.copy.disclaimer).toBeTruthy();
    expect(result.document_json!.property).toMatchObject({ address: ctx.workingListing.property_address, bedrooms: ctx.workingListing.bedrooms });
    expect(result.document_json).toMatchObject(kind === "lease" ? { ltr: { weekly_min: 1200, weekly_max: 1400 } } : { sale_estimate: { price_min: 2400000, price_max: 2600000 } });
    const comps = kind === "lease" ? result.document_json!.ltr_enrichment?.comps : result.document_json!.sales_enrichment?.comps;
    expect(comps).toHaveLength(6);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_appraisal_document", {
      p_agency_id: ctx.agency.id, p_report_id: reportId, p_expected_updated_at: expected, p_document: result.document_json,
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.leaseCopy).not.toHaveBeenCalled();
    expect(mocks.salesCopy).not.toHaveBeenCalled();
    expect({ appraisal: ctx.appraisal, listing: ctx.listing, workingListing: ctx.workingListing, report: ctx.report }).toEqual(before);
  });

  it("keeps ordinary preparation a no-op when the saved document matches the input revision", async () => {
    const ctx = context(kind);
    expect(await prepareAppraisalDocument(ctx, expected)).toBe(ctx.appraisal);
    expectNoWork();
  });

  it("still generates copy on ordinary preparation when inputs have changed", async () => {
    const ctx = context(kind);
    ctx.appraisal.document_revision = 2;
    await prepareAppraisalDocument(ctx, expected);
    expect(kind === "lease" ? mocks.leaseCopy : mocks.salesCopy).toHaveBeenCalledOnce();
    expect(kind === "lease" ? mocks.salesCopy : mocks.leaseCopy).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("rejects a stale timestamp before rebuilding or saving", async () => {
    const ctx = context(kind);
    await expect(prepareAppraisalDocument(ctx, "2026-10-15T00:00:00.000Z", { refreshCopy: true })).rejects.toMatchObject({ status: 409 });
    expectNoWork();
  });

  it.each(["report", "listing"] as const)("rejects an archived %s before rebuilding or saving", async target => {
    const ctx = context(kind);
    ctx[target].status = "archived";
    await expect(prepareAppraisalDocument(ctx, expected, { refreshCopy: true })).rejects.toMatchObject({ status: 409 });
    expectNoWork();
  });

  it("rejects stale property evidence rather than fetching more data during refresh", async () => {
    const ctx = context(kind);
    ctx.workingListing.bedrooms = 9;
    await expect(prepareAppraisalDocument(ctx, expected, { refreshCopy: true })).rejects.toThrow("Review the estimate and select at least one comparable");
    expectNoWork();
  });

  it("surfaces a concurrent update rejected by the saving RPC", async () => {
    const ctx = context(kind);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "This appraisal changed. Reload before generating." } });
    await expect(prepareAppraisalDocument(ctx, expected, { refreshCopy: true })).rejects.toMatchObject({ status: 409 });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

it("retains the sales agency-guide confirmation guard during wording refresh", async () => {
  const ctx = context("sales");
  ctx.workingListing.scraped_listing_json!.salesAppraisal!.agencyGuideReview = { required: true, confirmed: false, divergencePct: 20, reasons: ["Guide differs from comparable evidence"] };
  await expect(prepareAppraisalDocument(ctx, expected, { refreshCopy: true })).rejects.toThrow("Review and confirm the agency guide");
  expectNoWork();
});

function request(body: unknown, origin = "https://staypack.test") {
  return new Request(`https://staypack.test/api/appraisals/${reportId}/prepare`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
}
const params = () => ({ params: Promise.resolve({ reportId }) });

describe("prepare route", () => {
  it("passes the explicit refresh flag through the authenticated workflow", async () => {
    context("lease");
    const response = await POST(request({ expected_updated_at: expected, refresh_copy: true }), params());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).appraisal.document_json.copy.heading).not.toBe("Previous editable wording");
    expect(mocks.access).toHaveBeenCalledExactlyOnceWith(reportId);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.leaseCopy).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, false])("retains normal no-op behavior with refresh_copy %s", async refreshCopy => {
    context("sales");
    const response = await POST(request({ expected_updated_at: expected, ...(refreshCopy === undefined ? {} : { refresh_copy: refreshCopy }) }), params());
    expect(response.status).toBe(200);
    expectNoWork();
  });

  it.each([
    { expected_updated_at: expected, refresh_copy: "true" },
    { expected_updated_at: "yesterday", refresh_copy: true },
    { expected_updated_at: expected, refresh_copy: true, publish: true },
  ])("rejects malformed or unexpected inputs before loading account data", async body => {
    const response = await POST(request(body), params());
    expect(response.status).toBe(400);
    expect(mocks.access).not.toHaveBeenCalled();
    expectNoWork();
  });

  it("rejects cross-origin refresh requests", async () => {
    const response = await POST(request({ expected_updated_at: expected, refresh_copy: true }, "https://other.test"), params());
    expect(response.status).toBe(403);
    expect(mocks.access).not.toHaveBeenCalled();
    expectNoWork();
  });

  it("returns a conflict response for a stale refresh token", async () => {
    context("lease");
    const response = await POST(request({ expected_updated_at: "2026-10-15T00:00:00.000Z", refresh_copy: true }), params());
    expect(response.status).toBe(409);
    expectNoWork();
  });
});
