import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { proposalFromAppraisalReport, proposalFromReport } from "./data";
import { validateProposalDraft } from "./template";
import { defaultAssignment } from "./assignment";
import { buildProposalPdfReport, withPdfAgents } from "./pdfReport";
import { proposalSnapshotSchema } from "./workspace";
import { BRAND_DEFAULTS } from "./brand";
import { allowedProposalEvent } from "./activity";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { SALES_APPRAISAL_DISCLAIMER } from "@/lib/sales-appraisal/salesAppraisalDisclaimer";
import { SALES_APPRAISAL_COMPARABLE_DISCLAIMER } from "@/lib/sales-appraisal/comparableEvidenceCopy";
const f = createLintRegressionFixtures();
describe("typed appraisal proposals", () => {
  it.each(["lease","sales"] as const)("projects %s evidence and freezes a branded PDF without private fields", kind => {
    const report = structuredClone(f[kind].final_report_json!);
    const data = proposalFromAppraisalReport(report,kind,"Jordan Owner");
    expect(data.version).toBe(2);
    expect(data.appraisal?.kind).toBe(kind);
    expect(data.appraisal?.comparables).toHaveLength(6);
    expect(data.appraisal?.comparables[0].status).toBe(kind === "lease" ? "rental" : "sold");
    const pdf = buildProposalPdfReport(report)!;
    expect(pdf.template_id).toBe(report.template_id);
    expect(pdf.copy.disclaimer).toBeTruthy();
    expect(pdf).not.toHaveProperty("raw_airbtics_json");
    expect(pdf).not.toHaveProperty("document_link_draft");
    const selected = withPdfAgents(pdf,[{ name:"Agency Agent",role:"Director",email:"agent@example.com",phone:"0400000000",photoUrl:"" }]);
    expect(selected.agent.name).toBe("Agency Agent");
    const draft = defaultAssignment(f.agency,kind).defaults;
    expect(draft.pages.some(p => p.enabled && p.kind === "forecast")).toBe(false);
    const snapshot = proposalSnapshotSchema.parse({ version:1,data,draft,brand:BRAND_DEFAULTS,attachments:[],pdfReport:selected });
    report.copy.blurb = "Changed after publication";
    expect(snapshot.data.appraisal?.summary).not.toBe(report.copy.blurb);
    expect(allowedProposalEvent({ id:crypto.randomUUID(),session:crypto.randomUUID(),kind:"comparable",target:"0" },snapshot)).toBe(true);
    expect(allowedProposalEvent({ id:crypto.randomUUID(),session:crypto.randomUUID(),kind:"comparable",target:"7" },snapshot)).toBe(false);
  });
  it("rejects an STR design and forecast on a rental or sales proposal", () => {
    for (const kind of ["lease", "sales"] as const) {
      const data = proposalFromAppraisalReport(f[kind].final_report_json!, kind);
      expect(validateProposalDraft(defaultAssignment(f.agency).defaults, data).draft).toBeNull();
      const valid = defaultAssignment(f.agency, kind).defaults;
      expect(validateProposalDraft(valid, data).errors).toEqual([]);
      expect(validateProposalDraft({ ...valid, pages: [...valid.pages, { id: "forecast", kind: "forecast", title: "Forecast", body: "", enabled: true }] }, data).draft).toBeNull();
    }
  });
  it("keeps STR version 1 and the existing assignment unchanged", () => {
    expect(proposalFromReport(f.report.final_report_json!)).not.toHaveProperty("appraisal");
    expect(proposalFromReport(f.report.final_report_json!).version).toBe(1);
    expect(defaultAssignment(f.agency).defaults.templateId).toBe("editorial-base");
  });

  it("corrects inherited STR copy for new sales web/PDF versions while preserving published snapshots", () => {
    const report = structuredClone(f.sales.final_report_json!);
    report.copy.disclaimer = DEFAULT_DISCLAIMER;
    report.copy.comparable_disclaimer = DEFAULT_DISCLAIMER;
    const oldData = { ...proposalFromReport(report), version: 2 as const };
    const oldPdf = { ...buildProposalPdfReport(report)!, copy: { ...report.copy } };
    const stored = { version: 1, data: oldData, draft: defaultAssignment(f.agency, "sales").defaults,
      brand: BRAND_DEFAULTS, attachments: [], pdfReport: oldPdf };
    expect(proposalFromAppraisalReport(report, "sales").disclaimer).toBe(SALES_APPRAISAL_DISCLAIMER);
    const nextPdf = buildProposalPdfReport(report)!;
    expect(nextPdf.copy.disclaimer).toBe(SALES_APPRAISAL_DISCLAIMER);
    expect(nextPdf.copy.comparable_disclaimer).toBe(SALES_APPRAISAL_COMPARABLE_DISCLAIMER);
    const frozen = proposalSnapshotSchema.parse(stored);
    expect(frozen.data.disclaimer).toBe(DEFAULT_DISCLAIMER);
    expect(frozen.pdfReport!.copy.disclaimer).toBe(DEFAULT_DISCLAIMER);
    expect(report.copy.disclaimer).toBe(DEFAULT_DISCLAIMER);
    report.copy.disclaimer = "Custom sales terms.";
    expect(proposalFromAppraisalReport(report, "sales").disclaimer).toBe("Custom sales terms.");
    expect(buildProposalPdfReport(report)!.copy.disclaimer).toBe("Custom sales terms.");
  });
});
