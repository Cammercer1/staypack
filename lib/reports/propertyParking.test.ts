import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildLeaseAppraisalReport } from "@/lib/lease-appraisal/buildLeaseAppraisalReport";
import { buildLeaseAppraisalTemplatePreview } from "@/lib/lease-appraisal/templatePreviewDocument";
import { buildSalesAppraisalTemplatePreview } from "@/lib/sales-appraisal/templatePreviewDocument";
import { buildSalesAppraisalReport } from "@/lib/sales-appraisal/buildSalesAppraisalReport";
import { proposalFromReport, proposalFromAppraisalReport } from "@/lib/digital-proposals/data";
import { buildProposalPdfReport, proposalPdfReportSchema } from "@/lib/digital-proposals/pdfReport";
import { reportForProposal } from "@/lib/digital-proposals/fromAppraisal";
import { proposalPrintHtml } from "@/lib/digital-proposals/print";
import { defaultAssignment } from "@/lib/digital-proposals/assignment";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { buildFinalReportJson } from "./buildFinalReportJson";
import { REPORT_TEMPLATES } from "./templates/registry";
import { resolveReportPageVariant } from "./templates/shared/reportPageVariant";

const kinds = ["str", "lease", "sales"] as const;

describe("unknown property parking", () => {
  it.each(kinds)("preserves unknown and explicit parking through new %s documents and proposals", kind => {
    for (const carSpaces of [null, 0, 2]) {
      const f = createLintRegressionFixtures();
      const listing = { ...f.listing, car_spaces: carSpaces };
      const parsed = { ...listing.scraped_listing_json!, carSpaces: undefined };
      const source = kind === "str" ? f.report : f[kind];
      const before = structuredClone(source);
      const document = kind === "str"
        ? buildFinalReportJson({ agency: f.agency, listing, report: source, estimate: source.final_estimate_json!, copy: source.ai_copy_json! })
        : kind === "lease" ? buildLeaseAppraisalReport({ agency: f.agency, listing, report: source, parsed })
          : buildSalesAppraisalReport({ agency: f.agency, listing, report: source, parsed });
      // This is a new document; any older saved report is left exactly as it was.
      expect(document.property.car_spaces).toBe(carSpaces);
      expect(source).toEqual(before);
      const data = kind === "str" ? proposalFromReport(document) : proposalFromAppraisalReport(document, kind);
      expect(data.property.carSpaces).toBe(carSpaces);
      const printable = { ...document, template_id: kind === "str" ? "haven-properties-str" : document.template_id };
      const pdfReport = buildProposalPdfReport(printable)!;
      expect(proposalPdfReportSchema.parse(pdfReport).property.car_spaces).toBe(carSpaces);
      const html = proposalPrintHtml({ version: 1, data, draft: defaultAssignment(f.agency, kind).defaults, brand: BRAND_DEFAULTS, attachments: [], pdfReport });
      const cover = load(html)(".hero .overlay").text();
      if (carSpaces === null) expect(cover).not.toContain("car space");
      else expect(cover).toContain(`${carSpaces} car spaces`);
    }
  });

  it.each(["lease", "sales"] as const)("clearing imported parking remains unknown through the %s workspace build", kind => {
    const f = createLintRegressionFixtures();
    const listing = { ...f.listing, car_spaces: null, scraped_listing_json: { ...f.listing.scraped_listing_json!, carSpaces: 2 } };
    const before = structuredClone(listing);
    const build = kind === "lease" ? buildLeaseAppraisalTemplatePreview : buildSalesAppraisalTemplatePreview;
    const document = build({ agency: f.agency, listing, report: f[kind], templateId: f[kind].template_id! });
    expect(document!.property.car_spaces).toBeNull();
    expect(listing).toEqual(before);
    // The low-level import path still accepts a known provider value before review.
    const args = { agency: f.agency, listing, report: f[kind], parsed: listing.scraped_listing_json };
    const imported = kind === "lease" ? buildLeaseAppraisalReport(args) : buildSalesAppraisalReport(args);
    expect(imported.property.car_spaces).toBe(2);
  });

  it("retains a published zero even when the current property now has unknown parking", () => {
    const f = createLintRegressionFixtures();
    f.report.status = "published";
    f.report.final_report_json!.property.car_spaces = 0;
    f.listing.car_spaces = null;
    const before = structuredClone(f.report);
    const frozen = reportForProposal({ ...f, agencyAgents: [] });
    expect(frozen.property.car_spaces).toBe(0);
    expect(proposalFromReport(frozen).property.carSpaces).toBe(0);
    expect(f.report).toEqual(before);
    expect(reportForProposal({ ...f, agencyAgents: [], editable: true }).property.car_spaces).toBeNull();
  });

  it("renders unknown parking safely in every report template without inventing a zero", () => {
    const f = createLintRegressionFixtures();
    for (const template of REPORT_TEMPLATES) {
      const variant = resolveReportPageVariant({ template_id: template.id });
      const source = variant === "lease" ? f.lease : variant === "sales_appraisal" ? f.sales : f.report;
      const report = structuredClone(source.final_report_json!);
      report.template_id = template.id;
      report.property.car_spaces = null;
      const before = structuredClone(report);
      const $ = load(renderToStaticMarkup(createElement(template.Component, { report })));
      for (const icon of $(".report-page").first().find("svg.lucide-car, svg.lucide-car-front").toArray()) {
        expect($(icon).parent().text().trim(), template.id).not.toMatch(/^0(?:\s*(?:Cars?|Parking))?$/i);
      }
      expect(report).toEqual(before);
    }
  });
});
