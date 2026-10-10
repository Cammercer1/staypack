import { afterEach, expect, it, vi } from "vitest";
import { applyPhotoPosition, positionAirroiEstimate } from "./positionEstimate";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
const fixtures = createLintRegressionFixtures();
const estimate = { ...fixtures.report.final_estimate_json!, annualRevenue: 60000 };
const enrichment = { ...fixtures.report.str_enrichment_json!, revenue_range: { p25: 36000, p50: 60000, p75: 82000, p90: 108000 } };
const review = { percentile: 65, confidence: "medium" as const, rationale: "Visible renovation supported by comparable interiors.", observations: ["Subject kitchen compared to unit A", "Subject bathroom compared to unit B"], limitations: ["Availability unknown"], sufficient_visual_evidence: true };
afterEach(() => vi.unstubAllEnvs());
it("positions within the observed range without imposing a revenue floor", () => {
  const result = applyPhotoPosition(estimate, enrichment, review, { subject: 6, comps: 4, crediblePeers: 4 });
  expect(result.estimate.annualRevenue).toBe(73200);
  expect(result.positioning.percentile).toBe(65);
  expect(applyPhotoPosition(estimate, enrichment, { ...review, percentile: 25 }, { subject: 6, comps: 4, crediblePeers: 4 }).estimate.annualRevenue).toBe(36000);
});
it("retains the median for missing, sparse or inconclusive photos", () => {
  for (const result of [
    applyPhotoPosition(estimate, enrichment, null, { subject: 0, comps: 4, crediblePeers: 4 }),
    applyPhotoPosition(estimate, enrichment, review, { subject: 6, comps: 2, crediblePeers: 2 }),
    applyPhotoPosition(estimate, enrichment, { ...review, sufficient_visual_evidence: false }, { subject: 6, comps: 4, crediblePeers: 4 }),
  ]) {
    expect(result.estimate.annualRevenue).toBe(60000);
    expect(result.positioning.percentile).toBe(50);
    expect(result.positioning.confidence).toBe("low");
  }
});
it("keeps a usable estimate when image analysis is not configured", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const result = await positionAirroiEstimate(fixtures.listing, estimate, enrichment);
  expect(result.positioning.photo_review?.status).toBe("unavailable");
  expect(result.estimate.annualRevenue).toBe(60000);
});
