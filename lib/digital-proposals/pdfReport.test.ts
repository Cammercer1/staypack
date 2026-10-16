import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyHavenBrandKitToReport } from "@/lib/branding/kits/haven";
import { proposalFromReport, proposalFromAppraisalReport } from "./data";
import { defaultAssignment } from "./assignment";
import { proposalPrintHtml } from "./print";
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
  it.each(["str", "lease", "sales"] as const)("freezes matching client names in new %s web and PDF snapshots", kind => {
    const fixtures = createLintRegressionFixtures();
    const source = kind === "str" ? document() : structuredClone(fixtures[kind].final_report_json!);
    source.recipient = { displayName: "Previous recipient" };
    const original = structuredClone(source);
    const data = kind === "str" ? proposalFromReport(source, "  Jordan Taylor  ") : proposalFromAppraisalReport(source, kind, "  Jordan Taylor  ");
    const pdfReport = buildProposalPdfReport(source, data.recipient?.displayName)!;
    const snapshot = proposalSnapshotSchema.parse({ version: 1, data, pdfReport,
      draft: defaultAssignment(fixtures.agency, kind).defaults, brand: BRAND_DEFAULTS, attachments: [] });
    expect(snapshot.pdfReport?.recipient).toEqual(snapshot.data.recipient);
    expect(snapshot.pdfReport?.recipient).toEqual({ displayName: "Jordan Taylor" });
    expect(proposalPrintHtml(snapshot)).toContain("Prepared for Jordan Taylor");
    expect(withPdfAgents(pdfReport, []).recipient).toEqual(data.recipient);
    expect(source).toEqual(original);
    data.recipient!.displayName = "Updated client";
    source.recipient.displayName = "Edited source";
    expect(snapshot.data.recipient?.displayName).toBe("Jordan Taylor");
    expect(snapshot.pdfReport?.recipient?.displayName).toBe("Jordan Taylor");
    expect(buildProposalPdfReport(source, null)).not.toHaveProperty("recipient");
  });

  it("keeps client contact details out of printable snapshots and leaves legacy snapshots nameless", () => {
    const pdf = buildProposalPdfReport(document())!;
    expect(pdf).not.toHaveProperty("recipient");
    const parsed = proposalPdfReportSchema.parse({ ...pdf,
      recipient: { displayName: "Jordan Taylor", email: "private@example.com", phone: "0412345678", contact_id: "private-id" },
      recipient_email: "private@example.com", recipient_phone: "0412345678" });
    expect(parsed.recipient).toEqual({ displayName: "Jordan Taylor" });
    expect(JSON.stringify(parsed)).not.toContain("private@example.com");
    expect(parsed).not.toHaveProperty("recipient_phone");
    const draft = structuredClone(DEFAULT_PROPOSAL_DRAFT);
    draft.content.introduction = "Short-term rental proposal";
    draft.content.recipientLine = "prepared for {{recipient.displayName}}";
    const stored = { version: 1, data: proposalFromReport(document(), "Previously published client"), pdfReport: pdf,
      draft, brand: BRAND_DEFAULTS, attachments: [] };
    const before = JSON.stringify(stored);
    const legacy = proposalSnapshotSchema.parse(stored);
    expect(legacy.pdfReport).not.toHaveProperty("recipient");
    expect(legacy.draft.content.introduction).toBe("Short-term rental proposal");
    expect(legacy.draft.content.recipientLine).toBe("prepared for {{recipient.displayName}}");
    expect(JSON.stringify(stored)).toBe(before);
  });

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
