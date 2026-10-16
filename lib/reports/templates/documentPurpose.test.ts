import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { REPORT_TEMPLATES } from "./registry";
import { resolveReportPageVariant } from "./shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

const fixtures = createLintRegressionFixtures();

function reportForTemplate(templateId: string): FinalReportJson {
  const variant = resolveReportPageVariant({ template_id: templateId });
  const source = variant === "lease" ? fixtures.lease : variant === "sales_appraisal" ? fixtures.sales : fixtures.report;
  return {
    ...structuredClone(source.final_report_json!),
    template_id: templateId,
    property: { ...source.final_report_json!.property, display_price: "$9,876,543" },
    str: { ...source.final_report_json!.str, annual_revenue: 87654 },
    ltr: { ...source.final_report_json!.ltr, weekly_min: 880, weekly_max: 960, weekly_midpoint: 920 },
    sale_estimate: { price_min: 1500000, price_max: 1700000, price_midpoint: 1600000 },
  };
}

describe("report document purpose", () => {
  it.each(REPORT_TEMPLATES)("$id shows only the frozen client name once on its cover", template => {
    const report = reportForTemplate(template.id);
    const legacy = renderToStaticMarkup(createElement(template.Component, { report }));
    expect(legacy).not.toContain("data-report-recipient");
    report.recipient = { displayName: "Jordan & Taylor <Owner>" };
    const before = structuredClone(report);
    const html = renderToStaticMarkup(createElement(template.Component, { report }));
    const $ = load(html);
    expect($("[data-report-recipient]")).toHaveLength(1);
    expect($(".report-page").first().find("[data-report-recipient]").text()).toBe("Prepared for Jordan & Taylor <Owner>");
    expect(html).toContain("Jordan &amp; Taylor &lt;Owner&gt;");
    expect(report).toEqual(before);
    delete report.recipient;
    expect(renderToStaticMarkup(createElement(template.Component, { report }))).toBe(legacy);
  });

  it.each(REPORT_TEMPLATES)("$id shows its own estimate without an advertising banner", (template) => {
    const report = reportForTemplate(template.id);
    const original = structuredClone(report);
    const $ = load(renderToStaticMarkup(createElement(template.Component, { report })));
    const page = $(".report-page").first();
    const text = page.text();
    const variant = resolveReportPageVariant(report);
    expect(text).toContain(variant === "lease" ? "$880" : variant === "sales_appraisal" ? "$1,500,000" : "$87,654");
    expect(text).not.toContain("$9,876,543");
    expect(page.find("p,h1,h2,h3").toArray().map((node) => $(node).text().trim().toLowerCase()))
      .not.toEqual(expect.arrayContaining(["for sale"]));
    if (template.family === "landmark") {
      expect(text).toContain(variant === "lease" ? "Rental appraisal" : variant === "sales_appraisal" ? "Property appraisal" : "Short-term rental appraisal");
    }
    expect(report).toEqual(original);
  });

  it.each(REPORT_TEMPLATES.filter((template) => !template.id.includes("sales-appraisal")))(
    "$id never substitutes an asking price for a missing rental estimate",
    (template) => {
      const report = reportForTemplate(template.id);
      report.str.annual_revenue = null;
      report.ltr.weekly_min = null;
      report.ltr.weekly_max = null;
      report.ltr.weekly_midpoint = null;
      const $ = load(renderToStaticMarkup(createElement(template.Component, { report })));
      expect($(".report-page").first().text()).not.toContain("$9,876,543");
    },
  );
});
