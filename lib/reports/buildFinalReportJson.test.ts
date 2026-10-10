import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildFinalReportJson } from "./buildFinalReportJson";
import { applyStrEstimateAdjustments, saveStrRateOverride } from "./strEstimateAdjustments";

it("refreshing an estimate also replaces old revenue figures in saved bullets without changing unrelated prices", () => {
  const f = createLintRegressionFixtures();
  const document = buildFinalReportJson({ agency: f.agency, listing: f.listing, report: f.report,
    estimate: { ...f.report.final_estimate_json!, annualRevenue: 64296 },
    copy: { ...f.report.ai_copy_json!, property_appeal_points: ["Estimated gross short-term rental revenue: $126,743", "Guide price $1,250,000"], performance_supporting_factors: ["Estimated annual revenue of $126,743"] },
  });
  expect(document.copy.appeal_points).toEqual(["Estimated gross short-term rental revenue: $64,296", "Guide price $1,250,000"]);
  expect(document.copy.supporting_factors).toEqual(["Estimated annual revenue of $64,296"]);
});

it("freezes the market benchmark and management assumptions independently of company presets", () => {
  const f = createLintRegressionFixtures();
  const preset = f.agency.str_management_presets!.find((preset) => preset.mode !== "relative" && preset.mode !== "uplift")!;
  const rates = { nightlyRate: preset.nightlyRate, occupancyRate: preset.occupancyRate };
  const overrides = saveStrRateOverride(null, rates, { ...preset.assumptions, presetName: preset.name });
  const estimate = applyStrEstimateAdjustments(f.report.original_estimate_json!, rates);
  const document = buildFinalReportJson({ agency: f.agency, listing: f.listing, report: { ...f.report, user_overrides_json: overrides }, estimate, copy: f.report.ai_copy_json! });
  expect(document.str_scenario?.basis).toBe("management");
  expect(document.str_scenario?.market_benchmark.annual_revenue).toBe(f.report.original_estimate_json!.annualRevenue);
  expect(document.str.annual_revenue).toBe(115632);
  const snapshot = structuredClone(document);
  preset.nightlyRate = 900;
  preset.assumptions.rationale = "Changed later";
  f.agency.name = "Renamed later";
  expect(document).toEqual(snapshot);
  expect(document.str_scenario?.management?.rationale).toBe(overrides.strManagement!.rationale);
});
