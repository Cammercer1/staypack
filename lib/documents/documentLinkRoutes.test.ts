import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), draft: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireReportAccess: mocks.access, requireReportWithListing: mocks.access, requireCollateralAccess: mocks.access, requireAgency: mocks.access, requireListingAccess: mocks.access }));
vi.mock("@/lib/documents/createDocumentLinkDraft", () => ({ createDocumentLinkDraft: mocks.draft }));
vi.mock("@/lib/browserless/pdf", () => ({ renderPdfFromUrl: mocks.pdf, buildPdfImagePath: vi.fn(), buildPdfStylesheetPath: vi.fn() }));
import { PATCH as saveReportLink } from "@/app/api/reports/[id]/link/route";
import { PATCH as saveCollateralLink } from "@/app/api/collateral/[id]/link/route";
import { POST as publishReport } from "@/app/api/reports/[id]/publish/route";
import { POST as publishCollateral } from "@/app/api/collateral/[id]/publish/route";
import { POST as reportPdf } from "@/app/api/reports/[id]/generate-pdf/route";
import { POST as collateralPdf } from "@/app/api/collateral/[id]/generate-pdf/route";
import { POST as createLead } from "@/app/api/public/leads/route";
import { POST as regenerateListingQr } from "@/app/api/listings/[id]/regenerate-qr/route";
import { PATCH as updateLead } from "@/app/api/leads/[leadId]/route";
import { PATCH as updateListingLead } from "@/app/api/listings/[id]/leads/[leadId]/route";
import { createEmptyReportDraft } from "@/lib/reports/emptyReportDraft";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import { buildBusinessCardDocument } from "@/lib/collateral/buildBusinessCardDocument";

function setup() {
  const fixture = createLintRegressionFixtures();
  const writes: { table: string; body: Record<string, unknown>; filters: [string, unknown][] }[] = [];
  const state = { conflict: false, error: null as null | { message: string } };
  const supabase = { from: (table: string) => {
    let body: Record<string, unknown> = {};
    const filters: [string, unknown][] = [];
    const finish = async () => {
      writes.push({ table, body, filters });
      return { data: state.conflict ? null : { ...(table === "reports" ? context.report : context.collateral), ...body }, error: state.error };
    };
    const query = {
      update: (value: Record<string, unknown>) => { body = value; return query; },
      eq: (name: string, value: unknown) => { filters.push([name, value]); return query; },
      select: () => query,
      single: finish,
      maybeSingle: finish,
      then: (resolve: (value: Awaited<ReturnType<typeof finish>>) => unknown) => finish().then(resolve),
    };
    return query;
  } };
  const final = salesBrochureToReportShape(fixture.document);
  final.assets.qr_code_url = "https://assets.example/legacy.png";
  const context = {
    ...fixture, supabase,
    report: createEmptyReportDraft({ id: "report-one", agency_id: fixture.agency.id, listing_id: fixture.listing.id, status: "published", public_slug: "existing-report", public_url: "https://staypack.app/agency/existing-report", pdf_url: "https://assets.example/old.pdf", qr_code_url: final.assets.qr_code_url, final_report_json: final }),
  };
  return { context, writes, state };
}
let testState: ReturnType<typeof setup>;
const params = { params: Promise.resolve({ id: "document-one" }) };
const request = (body: unknown) => new Request("https://staypack.app/api/mock", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  testState = setup();
  mocks.access.mockResolvedValue(testState.context);
  mocks.draft.mockImplementation(async ({ link }) => ({ link, target_url: link.mode === "custom" ? link.url : "", qr_code_url: link.mode === "none" ? "" : "https://assets.example/new.png" }));
});

describe("report link API and publication", () => {
  it("saves a draft with agency and concurrency guards, leaving the published QR untouched", async () => {
    const result = await saveReportLink(request({ mode: "custom", url: "https://example.com/one" }), params);
    expect(result.status).toBe(200);
    const { report } = await result.json();
    expect(report.final_report_json.assets.qr_code_url).toBe("https://assets.example/legacy.png");
    expect(report.pdf_url).toBe("https://assets.example/old.pdf");
    expect(report.final_report_json.document_link_draft.target_url).toBe("https://example.com/one");
    expect(testState.writes[0].filters).toContainEqual(["agency_id", testState.context.agency.id]);
    expect(testState.writes[0].filters).toContainEqual(["updated_at", testState.context.report.updated_at]);
  });
  it("reserves a stable report slug for a new online-report QR", async () => {
    testState.context.report.public_slug = null;
    const result = await saveReportLink(request({ mode: "report" }), params);
    const { report } = await result.json();
    expect(mocks.draft.mock.calls[0][0].reportUrl).toContain(`/${report.public_slug}`);
    expect(report.public_slug).toBeTruthy();
  });
  it.each(["standard_2_page_v1", "lease_appraisal_v1", "sales_appraisal_v1"] as const)("publishes the saved choice for %s without mutating another report", async (version) => {
    const original = testState.context.report.final_report_json!;
    original.version = version;
    original.document_link_draft = { link: { mode: "none" }, target_url: "", qr_code_url: "" };
    const result = await publishReport(request({}), params);
    expect(result.status).toBe(200);
    const { report } = await result.json();
    expect(report.final_report_json.assets.qr_code_url).toBe("");
    expect(report.final_report_json.document_link_draft).toBeUndefined();
    expect(report.qr_code_url).toBeNull();
    expect(report.pdf_url).toBeNull();
    expect(original.assets.qr_code_url).toBe("https://assets.example/legacy.png");
    expect(mocks.draft).not.toHaveBeenCalled();
  });
  it("republishes a legacy report with its original QR when no choice was edited", async () => {
    const result = await publishReport(request({}), params);
    expect((await result.json()).qr_code_url).toBe("https://assets.example/legacy.png");
    expect(mocks.draft).not.toHaveBeenCalled();
  });
  it("refuses an invalid URL before generating a QR or writing a row", async () => {
    expect((await saveReportLink(request({ mode: "custom", url: "javascript:alert(1)" }), params)).status).toBe(400);
    expect(mocks.draft).not.toHaveBeenCalled();
    expect(testState.writes).toHaveLength(0);
  });
  it("returns a conflict instead of claiming an overwritten draft was saved", async () => {
    testState.state.conflict = true;
    expect((await saveReportLink(request({ mode: "none" }), params)).status).toBe(409);
  });
  it("reports persistence failure", async () => {
    testState.state.error = { message: "Database unavailable" };
    const result = await saveReportLink(request({ mode: "none" }), params);
    expect(result.status).toBe(400);
    expect((await result.json()).error).toContain("Database unavailable");
  });
  it("does not save or generate assets when access is denied", async () => {
    mocks.access.mockRejectedValue(new Error("Report not found"));
    expect((await saveReportLink(request({ mode: "none" }), params)).status).toBe(400);
    expect(testState.writes).toHaveLength(0);
    expect(mocks.draft).not.toHaveBeenCalled();
  });
  it("requires publication before generating a PDF of a saved link edit", async () => {
    testState.context.report.final_report_json!.document_link_draft = { link: { mode: "none" }, target_url: "", qr_code_url: "" };
    expect((await reportPdf(request({}), params)).status).toBe(409);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});

describe("brochure and card link APIs", () => {
  it.each(["sales_brochure", "rental_brochure"] as const)("saves and publishes an independent %s link", async (type) => {
    testState.context.collateral.type = type;
    const saved = await saveCollateralLink(request({ mode: "custom", url: `https://example.com/${type}` }), params);
    expect(saved.status).toBe(200);
    const { collateral } = await saved.json();
    expect(collateral.document_json.document_link_draft.target_url).toBe(`https://example.com/${type}`);
    testState.context.collateral = collateral;
    const published = await publishCollateral(request({}), params);
    const result = (await published.json()).collateral;
    expect(result.document_json.document_link_draft).toBeUndefined();
    expect(result.document_json.qr_target_url).toBe(`https://example.com/${type}`);
    expect(result.document_json.assets.qr_code_url).toBe("https://assets.example/new.png");
  });
  it("allows no QR on a brochure", async () => {
    const saved = await saveCollateralLink(request({ mode: "none" }), params);
    testState.context.collateral = (await saved.json()).collateral;
    const result = await publishCollateral(request({}), params);
    expect((await result.json()).collateral.document_json.assets.qr_code_url).toBe("");
  });
  it("does not offer an online viewer for collateral that lacks one", async () => {
    expect((await saveCollateralLink(request({ mode: "report" }), params)).status).toBe(400);
    expect(testState.writes).toHaveLength(0);
  });
  it("saves a business card's destination without requiring a property", async () => {
    const fixture = testState.context;
    fixture.collateral.type = "agent_business_card";
    fixture.collateral.listing_id = null;
    fixture.collateral.document_json = buildBusinessCardDocument({ agency: fixture.agency, listing: null, collateral: fixture.collateral });
    const response = await saveCollateralLink(request({ mode: "custom", url: "https://example.com/agent" }), params);
    const { collateral } = await response.json();
    expect(collateral.document_json.document_link.mode).toBe("custom");
    expect(collateral.document_json.document_link_draft).toBeUndefined();
    expect(collateral.document_json.qr_target_url).toBe("https://example.com/agent");
    expect(collateral.pdf_url).toBeNull();
  });
  it("blocks brochure PDF generation while a link change awaits publication", async () => {
    const saved = await saveCollateralLink(request({ mode: "none" }), params);
    testState.context.collateral = (await saved.json()).collateral;
    expect((await collateralPdf(request({}), params)).status).toBe(409);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});

describe("retired feature endpoints", () => {
  it("cannot accept new leads or regenerate listing QR codes", async () => {
    expect((await createLead(request({}))).status).toBe(410);
    expect((await regenerateListingQr(request({}), params)).status).toBe(410);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("keeps historical enquiries read-only", async () => {
    expect((await updateLead(request({ status: "contacted" }), { params: Promise.resolve({ leadId: "lead" }) })).status).toBe(410);
    expect((await updateListingLead(request({ status: "contacted" }), { params: Promise.resolve({ id: "property", leadId: "lead" }) })).status).toBe(410);
    expect(testState.writes).toHaveLength(0);
  });
});
