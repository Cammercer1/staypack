import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { proposalFromAppraisalReport } from "@/lib/digital-proposals/data";
import { buildProposalPdfReport } from "@/lib/digital-proposals/pdfReport";
import { marketForCountry, monthlyToWeekly } from "@/lib/property-market";
import { AppraisalSummary, AppraisalComparables } from "./AppraisalSections";
vi.mock("./ProposalTracking", () => ({ useProposalTracking: () => () => {} }));
vi.mock("./PreparedProposalPage", () => ({ useProposalPageVisible: () => true }));
it.each(["lease", "sales"] as const)("renders frozen US %s proposals in USD with local rent periods", kind => {
  const report = structuredClone(createLintRegressionFixtures()[kind].final_report_json!);
  report.market = marketForCountry("US");
  report.ltr = { ...report.ltr, market: report.market, weekly_min: monthlyToWeekly(6000), weekly_max: monthlyToWeekly(6500), weekly_midpoint: monthlyToWeekly(6250) };
  if (report.ltr_enrichment) { report.ltr_enrichment.comps[0].weekly_rent = monthlyToWeekly(6300); report.ltr_enrichment.suburb_market = null; }
  report.sale_estimate = { price_min: 1500000, price_max: 1700000, price_midpoint: 1600000 };
  report.copy = { ...report.copy, blurb: "US property appraisal.", appeal_points: [], methodology_note: "Based on comparable evidence.", comparable_evidence: "" };
  const data = proposalFromAppraisalReport(report, kind);
  const html = renderToStaticMarkup(<><AppraisalSummary data={data} /><AppraisalComparables data={data} /></>);
  expect(html).toContain(kind === "lease" ? "US$6,000" : "US$1,500,000");
  if (kind === "lease") { expect(html).toContain("US$6,300"); expect(html).toContain("per month"); expect(html).not.toContain("weekly"); expect(html).not.toContain("/ week"); }
  expect(buildProposalPdfReport(report)?.market).toEqual(report.market);
  report.market = marketForCountry("AU");
  expect(data.market?.currency).toBe("USD");
});
it("keeps legacy published Australian rentals weekly", () => {
  const report = structuredClone(createLintRegressionFixtures().lease.final_report_json!);
  delete report.market;
  const data = proposalFromAppraisalReport(report, "lease");
  const html = renderToStaticMarkup(<AppraisalSummary data={data} />);
  expect(html).toContain("per week");
  expect(html).not.toContain("US$");
});

it.each(["lease", "sales"] as const)("uses singular feature labels for a one-bedroom %s comparable", kind => {
  const data = proposalFromAppraisalReport(createLintRegressionFixtures()[kind].final_report_json!, kind);
  data.appraisal!.comparables = [{ ...data.appraisal!.comparables[0], bedrooms: 1, bathrooms: 1 }];
  const html = renderToStaticMarkup(<AppraisalComparables data={data} />);
  expect(html).toContain("1 bedroom · 1 bathroom");
  expect(html).not.toContain("1 bedrooms");
  expect(html).not.toContain("1 bathrooms");
});

it.each(["1 Jul 2026", "2026-07-01T00:00:00+10:00"])("keeps the source sale date on the public proposal: %s", soldDate => {
  const data = proposalFromAppraisalReport(createLintRegressionFixtures().sales.final_report_json!, "sales");
  data.appraisal!.comparables = [{ ...data.appraisal!.comparables[0], soldDate, status: "sold" }];
  const html = renderToStaticMarkup(<AppraisalComparables data={data} />);
  expect(html).toContain("Sold 1 July 2026");
  expect(html).not.toContain("30 June 2026");
});
