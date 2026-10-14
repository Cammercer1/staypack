import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyHavenBrandKitToReport } from "@/lib/branding/kits/haven";
import { proposalFromReport } from "./data";
import { buildProposalPdfReport, proposalPdfReportSchema, withPdfAgents } from "./pdfReport";
import { createPrintAccessToken } from "@/lib/reports/printAccessToken";
import { proposalPrintUrl, verifyProposalPrintToken } from "./printAccess";
import { buildStrTemplatePreview } from "@/lib/reports/templatePreviewDocument";

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
