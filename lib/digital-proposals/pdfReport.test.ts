import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyHavenBrandKitToReport } from "@/lib/branding/kits/haven";
import { proposalFromReport } from "./data";
import { buildProposalPdfReport, proposalPdfReportSchema, withPdfAgents } from "./pdfReport";
import { createPrintAccessToken } from "@/lib/reports/printAccessToken";
import { proposalPrintUrl, verifyProposalPrintToken } from "./printAccess";
import { buildStrTemplatePreview } from "@/lib/reports/templatePreviewDocument";
import { reportForProposal } from "./fromAppraisal";
import { proposalSnapshotSchema } from "./workspace";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";
import { BRAND_DEFAULTS } from "./brand";

describe("Havenly proposal PDF snapshot", () => {
  function document() {
    const fixture = createLintRegressionFixtures();
    return buildStrTemplatePreview({ agency: fixture.agency, listing: fixture.listing, report: fixture.report, agencyAgents: [], templateId: "haven-properties-str" });
  }
  it("freezes the branded report and strips private and unused inputs", () => {
    const source = document();
    const result = buildProposalPdfReport({ ...source, document_link_draft: { link: { mode: "custom", url: "https://private.test" }, target_url: "https://private.test", qr_code_url: "private" } })!;
    const expected = proposalFromReport(source);
    source.str.annual_revenue = 1;
    expect(proposalFromReport(result).str).toEqual(expected.str);
    expect(result.property.estimated_value).toBe(source.property.estimated_value);
    expect(result.assets).toEqual({ qr_code_url: "", pdf_url: "" });
    expect(result).not.toHaveProperty("document_link_draft");
    expect(result.str_enrichment).not.toHaveProperty("comp_pool");
    if (result.str_enrichment?.market_occupancy) expect(result.str_enrichment.market_occupancy).not.toHaveProperty("raw");
    expect(proposalPdfReportSchema.safeParse({ ...result, copy: { ...result.copy, disclaimer: "" } }).success).toBe(false);
  });
  it("prepares an estimated STR appraisal without an advertised sale price", () => {
    const fixture = createLintRegressionFixtures();
    fixture.listing.listing_url = null;
    fixture.listing.display_price = null;
    fixture.listing.advertised_sale_price = null;
    fixture.report.status = "estimated";
    fixture.report.template_id = "haven-properties-str";
    fixture.report.final_report_json = null;
    fixture.report.ai_copy_json = null;
    fixture.report.user_overrides_json = {
      strProperty: { propertyValue: 1240000, weeklyRent: 1155, amenities: [], additionalAmenities: [] },
    };
    const before = structuredClone(fixture);
    const source = reportForProposal({ ...fixture, agencyAgents: [], editable: true });
    expect(source.property.display_price).toBeNull();
    const data = proposalFromReport(source);
    const pdfReport = buildProposalPdfReport(source)!;
    const snapshot = proposalSnapshotSchema.parse({
      version: 1, data, pdfReport, draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [],
    });
    expect(snapshot.pdfReport?.property.display_price).toBeNull();
    expect(snapshot.data.property.estimatedValue).toBe(1240000);
    expect(withPdfAgents(pdfReport, []).property.display_price).toBeNull();
    expect(fixture).toEqual(before);
  });
  it("keeps only explicitly selected agents through repeated brand application, including no agents", () => {
    const pdf = buildProposalPdfReport(document())!;
    const empty = applyHavenBrandKitToReport(applyHavenBrandKitToReport(pdf));
    expect(empty.agents).toEqual([]); expect(empty.agent.name).toBe("");
    const selected = withPdfAgents(pdf, [{ name: "Selected adviser", role: "Manager", phone: "0412345678", email: "chosen@example.com", photoUrl: "" }]);
    const branded = applyHavenBrandKitToReport(applyHavenBrandKitToReport(selected));
    expect(branded.agents.map(agent => agent.name)).toEqual(["Selected adviser"]);
    expect(branded.agent.email).toBe("chosen@example.com");
    expect(applyHavenBrandKitToReport(document()).agents.map(agent => agent.name)).toContain("Shannyn Laird");
  });
  it("leaves other PDF designs alone and scopes print tokens to one version", () => {
    expect(buildProposalPdfReport({ ...document(), template_id: "classic" })).toBeUndefined();
    const version = "10000000-0000-4000-8000-000000000001";
    const url = new URL(proposalPrintUrl(version, "https://staypack.app"));
    const token = url.searchParams.get("token")!;
    expect(verifyProposalPrintToken(version, token)).toBe(true);
    expect(verifyProposalPrintToken("another-version", token)).toBe(false);
    expect(verifyProposalPrintToken(version, createPrintAccessToken(version))).toBe(false);
    expect(verifyProposalPrintToken(version, "0." + "a".repeat(64))).toBe(false);
  });
});
