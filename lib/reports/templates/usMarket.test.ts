import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { REPORT_TEMPLATES } from "./registry";
import { resolveReportPageVariant } from "./shared/reportPageVariant";
import { marketForCountry, monthlyToWeekly } from "@/lib/property-market";
import { proposalFromReport } from "@/lib/digital-proposals/data";
import { buildProposalPdfReport } from "@/lib/digital-proposals/pdfReport";
import { formatToken } from "@/lib/digital-proposals/tokens";
const fixtures = createLintRegressionFixtures(), market = marketForCountry("US");
describe("frozen US report rendering", () => {
  it.each(REPORT_TEMPLATES)("$id renders USD and monthly lease amounts", (template) => {
    const variant = resolveReportPageVariant({ template_id: template.id });
    const source = variant === "lease" ? fixtures.lease : variant === "sales_appraisal" ? fixtures.sales : fixtures.report;
    const report = structuredClone(source.final_report_json!);
    report.market = market;
    report.template_id = template.id;
    report.ltr = { ...report.ltr, market, weekly_min: monthlyToWeekly(6000), weekly_max: monthlyToWeekly(6500), weekly_midpoint: monthlyToWeekly(6250), annual_midpoint: 75000 };
    report.sale_estimate = { price_min: 1500000, price_max: 1700000, price_midpoint: 1600000 };
    report.str.annual_revenue = 87654;
    report.copy = { ...report.copy, blurb: "US property appraisal.", blurb_variants: undefined, appeal_points: [], key_metrics_line: "" };
    const original = structuredClone(report);
    const text = load(renderToStaticMarkup(createElement(template.Component, { report })))(".report-page").first().text();
    expect(text).toContain(variant === "lease" ? "US$6,000" : variant === "sales_appraisal" ? "US$1,500,000" : "US$87,654");
    if (variant === "lease") { expect(text).not.toMatch(/weekly|per week|\/wk|\/ week/i); expect(text).toMatch(/month|\/mo/); }
    expect(report).toEqual(original);
  });
  it("preserves market metadata in the public proposal and PDF allowlists", () => {
    const report = structuredClone(fixtures.report.final_report_json!);
    report.market = market; report.template_id = "haven-properties-str";
    report.ltr = { ...report.ltr, market, weekly_midpoint: monthlyToWeekly(6269), annual_midpoint: 75228 };
    const data = proposalFromReport(report);
    expect(data.market).toEqual(market);
    expect(formatToken("ltr.monthlyRent", data)).toBe("US$6,269");
    expect(buildProposalPdfReport(report)?.market).toEqual(market);
    expect(buildProposalPdfReport(report)?.ltr.market).toEqual(market);
  });
});
