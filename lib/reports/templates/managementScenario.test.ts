import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { REPORT_TEMPLATES } from "./registry";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { applyStrEstimateAdjustments, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";

it.each(REPORT_TEMPLATES.filter((template) => !/lease|sales/.test(template.id)))("$id labels management estimates and includes the separate benchmark", ({ id, Component }) => {
  const f = createLintRegressionFixtures();
  const rates = { nightlyRate: 330, occupancyRate: 68 };
  const report = buildFinalReportJson({ agency: f.agency, listing: f.listing, report: { ...f.report, template_id: id, user_overrides_json: saveStrRateOverride(null, rates, { unavailableNights: 30, listingStage: "established", rationale: "Assumes professional presentation and active pricing." }) }, estimate: applyStrEstimateAdjustments(f.report.original_estimate_json!, rates), copy: f.report.ai_copy_json! });
  const html = renderToStaticMarkup(createElement(Component, { report }));
  expect(html).toContain("Managed STR revenue estimate");
  expect(html).toContain("Market benchmark:");
  expect(html).toContain("$81,906");
  expect(html).toContain("$98,500");
  expect(html).not.toContain("Median gross revenue");
});

it("does not invent management assumptions for an existing report without a scenario", () => {
  const f = createLintRegressionFixtures();
  const Component = REPORT_TEMPLATES[0].Component;
  const html = renderToStaticMarkup(createElement(Component, { report: f.report.final_report_json! }));
  expect(html).not.toContain("Managed STR revenue estimate");
  expect(html).not.toContain("str-scenario-summary");
});
