import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { SALES_APPRAISAL_COMPARABLE_DISCLAIMER } from "./comparableEvidenceCopy";
import { buildSalesAppraisalReport } from "./buildSalesAppraisalReport";
import { deriveSalesAppraisalCopy } from "./deriveSalesAppraisalCopy";
import { SALES_APPRAISAL_DISCLAIMER, resolveSalesAppraisalCopyDisclaimers, resolveSalesAppraisalDisclaimer, resolveSalesAppraisalComparableDisclaimer } from "./salesAppraisalDisclaimer";

it.each([undefined, null, " ", DEFAULT_DISCLAIMER, DEFAULT_DISCLAIMER.replaceAll(" ", "\n")])("uses sales wording instead of an absent or inherited STR disclaimer: %s", value => {
  expect(resolveSalesAppraisalDisclaimer(value)).toBe(SALES_APPRAISAL_DISCLAIMER);
  expect(resolveSalesAppraisalComparableDisclaimer(value)).toBe(SALES_APPRAISAL_COMPARABLE_DISCLAIMER);
});

it("preserves deliberately customised copy without mutating its source", () => {
  const custom = { disclaimer: "Custom sales disclaimer.", comparable_disclaimer: "Custom evidence note.", heading: "Heading" };
  expect(resolveSalesAppraisalCopyDisclaimers(custom)).toEqual(custom);
  const inherited = { ...custom, disclaimer: DEFAULT_DISCLAIMER, comparable_disclaimer: DEFAULT_DISCLAIMER };
  const result = resolveSalesAppraisalCopyDisclaimers(inherited);
  expect(result.disclaimer).toBe(SALES_APPRAISAL_DISCLAIMER);
  expect(result.comparable_disclaimer).toBe(SALES_APPRAISAL_COMPARABLE_DISCLAIMER);
  expect(inherited.disclaimer).toBe(DEFAULT_DISCLAIMER);
});

it("corrects both newly derived copy and legacy copy supplied while rebuilding a sales report", () => {
  const f = createLintRegressionFixtures();
  const agency = { ...f.agency, default_disclaimer: DEFAULT_DISCLAIMER };
  const parsed = resolveAppraisalInput(f.listing);
  const copy = deriveSalesAppraisalCopy({ agency, listing: f.listing, parsed, soldCompCount: 6, forSaleCompCount: 0, priceMin: 2400000, priceMax: 2600000 });
  expect(copy.disclaimer).toBe(SALES_APPRAISAL_DISCLAIMER);
  const report = buildSalesAppraisalReport({ agency, listing: f.listing, report: f.sales, parsed,
    copy: { ...copy, disclaimer: DEFAULT_DISCLAIMER, comparable_disclaimer: DEFAULT_DISCLAIMER } });
  expect(report.copy.disclaimer).toBe(SALES_APPRAISAL_DISCLAIMER);
  expect(report.copy.comparable_disclaimer).toBe(SALES_APPRAISAL_COMPARABLE_DISCLAIMER);
});
