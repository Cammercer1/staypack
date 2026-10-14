import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildFinalReportJson } from "./buildFinalReportJson";
import { applyStrEstimateAdjustments, saveStrRateOverride } from "./strEstimateAdjustments";
import { enrichFinalReportMetrics } from "./enrichFinalReportMetrics";
import { resolveStrGrossYield } from "./calculateStrYield";

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

it("freezes the reviewed LTR baseline and amenities without repricing STR", () => {
  const f = createLintRegressionFixtures();
  const baseline = structuredClone(f.report.final_estimate_json!);
  const report = { ...f.report, user_overrides_json: { ...f.report.user_overrides_json, strProperty: { weeklyRent: 950, amenities: ["pool" as const], additionalAmenities: ["Tennis court"] } } };
  const document = buildFinalReportJson({ agency: f.agency, listing: f.listing, report, estimate: baseline, copy: f.report.ai_copy_json! });
  expect(document.ltr).toMatchObject({ weekly_midpoint: 950, annual_midpoint: 49400 });
  expect(document.property.amenities).toEqual(["Pool", "Tennis court"]);
  expect(document.str.annual_revenue).toBe(baseline.annualRevenue);
  expect(f.report.final_estimate_json).toEqual(baseline);
  report.user_overrides_json.strProperty.weeklyRent = 1000;
  expect(document.ltr?.annual_midpoint).toBe(49400);
});
it("an explicitly cleared STR weekly rent does not fall back to the listing's LTR appraisal", () => {
  const f = createLintRegressionFixtures();
  const document = buildFinalReportJson({ agency: f.agency, listing: f.listing, report: { ...f.report, user_overrides_json: { strProperty: { weeklyRent: null, amenities: [], additionalAmenities: [] } } }, estimate: f.report.final_estimate_json!, copy: f.report.ai_copy_json! });
  expect(document.ltr.weekly_midpoint).toBeNull();
  expect(document.ltr.annual_midpoint).toBeNull();
});

it("freezes the appraisal value as the STR yield basis independently of the asking price", () => {
  const f = createLintRegressionFixtures();
  f.listing.advertised_sale_price = "$2,000,000";
  const report = { ...f.report, user_overrides_json: { strProperty: { propertyValue: 1000000, weeklyRent: 950, amenities: [], additionalAmenities: [] } } };
  const document = buildFinalReportJson({ agency: f.agency, listing: f.listing, report, estimate: { ...f.report.final_estimate_json!, annualRevenue: 60000 }, copy: f.report.ai_copy_json! });
  expect(document.property.estimated_value).toBe(1000000);
  expect(document.str_yield).toMatchObject({ price_midpoint: 1000000, yield_midpoint_percent: 6 });
  report.user_overrides_json.strProperty.propertyValue = 1500000;
  f.listing.display_price = "$3,000,000";
  expect(enrichFinalReportMetrics(f.listing, document).str_yield?.yield_midpoint_percent).toBe(6);
  expect(document.property.estimated_value).toBe(1000000);
});

it.each([null, undefined])("never substitutes an asking price when appraisal value is %s", (propertyValue) => {
  const f = createLintRegressionFixtures();
  f.listing.advertised_sale_price = "$2,000,000";
  f.listing.scraped_listing_json = { ...f.listing.scraped_listing_json!, domainAvm: undefined };
  const report = { ...f.report, user_overrides_json: { strProperty: { propertyValue, weeklyRent: 950, amenities: [], additionalAmenities: [] } } };
  const document = buildFinalReportJson({ agency: f.agency, listing: f.listing, report, estimate: f.report.final_estimate_json!, copy: f.report.ai_copy_json! });
  expect(document.property.estimated_value).toBeNull();
  expect(document.str_yield).toBeNull();
  expect(enrichFinalReportMetrics(f.listing, document).str_yield).toBeNull();
  expect(resolveStrGrossYield({ estimated_value: null, display_price: "$2,000,000", annual_revenue: 60000 })).toBeNull();
});

it("keeps legacy published yield snapshots compatible", () => {
  const legacyYield = resolveStrGrossYield({ display_price: "$2,000,000", annual_revenue: 60000 });
  expect(legacyYield?.yield_midpoint_percent).toBe(3);
  expect(resolveStrGrossYield({ str_yield: legacyYield, display_price: "$1,000,000", annual_revenue: 60000 })).toEqual(legacyYield);
});
