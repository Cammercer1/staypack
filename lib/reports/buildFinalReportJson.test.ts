import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildFinalReportJson } from "./buildFinalReportJson";

it("refreshing an estimate also replaces old revenue figures in saved bullets without changing unrelated prices", () => {
  const f = createLintRegressionFixtures();
  const document = buildFinalReportJson({ agency: f.agency, listing: f.listing, report: f.report,
    estimate: { ...f.report.final_estimate_json!, annualRevenue: 64296 },
    copy: { ...f.report.ai_copy_json!, property_appeal_points: ["Estimated gross short-term rental revenue: $126,743", "Guide price $1,250,000"], performance_supporting_factors: ["Estimated annual revenue of $126,743"] },
  });
  expect(document.copy.appeal_points).toEqual(["Estimated gross short-term rental revenue: $64,296", "Guide price $1,250,000"]);
  expect(document.copy.supporting_factors).toEqual(["Estimated annual revenue of $64,296"]);
});
