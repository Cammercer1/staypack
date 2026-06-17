import { describe, expect, it } from "vitest";
import {
  buildCompAnchors,
  clampPercentile,
  clampPositionedAnnualRevenue,
  deriveCompAwareBounds,
  deriveMetricsFromRevenue,
  estimateAtPercentile,
  estimateAtRevenue,
  extractStrQualitySignals,
  extractPercentileKpis,
  percentileFromRevenue,
  positionStrEstimate,
  resolvePositionedAnnualRevenue,
  selectPromptComps,
} from "@/lib/airbtics/positionEstimate";
import type { StrEstimate } from "@/lib/types";

const KIRRA_KPIS = {
  "25": { ltm_revenue: 51881, ltm_nightly_rate: 206, ltm_occupancy_rate: 69 },
  "50": { ltm_revenue: 69415, ltm_nightly_rate: 258, ltm_occupancy_rate: 74 },
  "75": { ltm_revenue: 103934, ltm_nightly_rate: 335, ltm_occupancy_rate: 85 },
  "90": { ltm_revenue: 139842, ltm_nightly_rate: 391, ltm_occupancy_rate: 98 },
};

function baseEstimate(raw: unknown): StrEstimate {
  return {
    annualRevenue: 69415,
    monthlyRevenue: 5785,
    weeklyRevenue: 1335,
    nightlyRate: 258,
    occupancyRate: 74,
    bookedNights: 270,
    radiusM: 218,
    raw,
  };
}

describe("extractPercentileKpis", () => {
  it("extracts ordered percentile points from raw kpis", () => {
    const points = extractPercentileKpis({ kpis: KIRRA_KPIS });
    expect(points.map((p) => p.percentile)).toEqual([25, 50, 75, 90]);
    expect(points[1].revenue).toBe(69415);
    expect(points[3].occupancyRate).toBe(98);
  });

  it("unwraps message envelope and skips incomplete points", () => {
    const points = extractPercentileKpis({
      message: { kpis: { "50": { ltm_revenue: 1000 }, "75": {} } },
    });
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ percentile: 50, revenue: 1000 });
  });

  it("returns empty for missing kpis", () => {
    expect(extractPercentileKpis(null)).toEqual([]);
    expect(extractPercentileKpis({})).toEqual([]);
  });
});

describe("extractStrQualitySignals", () => {
  it("extracts compact property quality signals from listing text", () => {
    const signals = extractStrQualitySignals({
      title: "Luxury beachfront apartment with ocean views",
      description:
        "Fully renovated with premium finishes, pool, secure parking, air conditioning and an easy walk to cafes.",
      propertyType: "Apartment",
    });

    expect(signals).toContain("water or coastal view / position");
    expect(signals).toContain("new, renovated or premium presentation");
    expect(signals).toContain("strong outdoor amenity");
    expect(signals).toContain("parking or easy access");
    expect(signals).toContain("comfort features");
    expect(signals).toContain("walkable beach or lifestyle location");
  });
});

describe("selectPromptComps", () => {
  it("keeps a compact, priority-ordered set of same-bed and strong comps", () => {
    const comps = Array.from({ length: 24 }, (_, index) => ({
      listingID: `comp-${index}`,
      bedrooms: index % 3 === 0 ? 2 : 3,
      distance: 40 + index * 25,
      annual_revenue_ltm: 50_000 + index * 4_000,
      similarity_score: 1 - index * 0.02,
    }));

    const selected = selectPromptComps(comps, 2, 10);

    expect(selected).toHaveLength(10);
    expect(selected.some((comp) => comp.listingID === "comp-0")).toBe(true);
    expect(selected.some((comp) => comp.listingID === "comp-21")).toBe(true);
    expect(new Set(selected.map((comp) => comp.listingID)).size).toBe(
      selected.length,
    );
  });
});

describe("clampPercentile", () => {
  it("clamps to [25, 90] and rounds", () => {
    expect(clampPercentile(10)).toBe(25);
    expect(clampPercentile(95)).toBe(90);
    expect(clampPercentile(66.6)).toBe(67);
    expect(clampPercentile(NaN)).toBe(50);
  });
});

describe("estimateAtPercentile", () => {
  const points = extractPercentileKpis({ kpis: KIRRA_KPIS });

  it("returns exact KPI values at known percentiles", () => {
    const at75 = estimateAtPercentile(baseEstimate({}), points, 75);
    expect(at75.annualRevenue).toBe(103934);
    expect(at75.nightlyRate).toBe(335);
    expect(at75.occupancyRate).toBe(85);
    expect(at75.monthlyRevenue).toBe(Math.round(103934 / 12));
    expect(at75.bookedNights).toBe(Math.round((85 / 100) * 365));
  });

  it("interpolates between percentile points", () => {
    const at65 = estimateAtPercentile(baseEstimate({}), points, 65);
    // 60% of the way from p50 to p75
    expect(at65.annualRevenue).toBe(Math.round(69415 + (103934 - 69415) * 0.6));
    expect(at65.annualRevenue).toBeGreaterThan(69415);
    expect(at65.annualRevenue).toBeLessThan(103934);
  });

  it("clamps out-of-range percentiles to the distribution bounds", () => {
    expect(estimateAtPercentile(baseEstimate({}), points, 5).annualRevenue).toBe(
      51881,
    );
    expect(
      estimateAtPercentile(baseEstimate({}), points, 99).annualRevenue,
    ).toBe(139842);
  });

  it("falls back to the base estimate when no points exist", () => {
    const base = baseEstimate({});
    expect(estimateAtPercentile(base, [], 75)).toEqual(base);
  });

  it("preserves raw payload and radius", () => {
    const raw = { some: "payload" };
    const positioned = estimateAtPercentile(baseEstimate(raw), points, 80);
    expect(positioned.raw).toBe(raw);
    expect(positioned.radiusM).toBe(218);
  });
});

describe("percentileFromRevenue", () => {
  const points = extractPercentileKpis({ kpis: KIRRA_KPIS });

  it("maps revenue back to the matching percentile", () => {
    expect(percentileFromRevenue(points, 69415)).toBe(50);
    expect(percentileFromRevenue(points, 103934)).toBe(75);
  });
});

describe("deriveMetricsFromRevenue", () => {
  it("derives nightly rate from revenue and occupancy", () => {
    const metrics = deriveMetricsFromRevenue(160_000, 63);
    expect(metrics.occupancyRate).toBe(63);
    expect(metrics.bookedNights).toBe(Math.round(0.63 * 365));
    expect(metrics.nightlyRate * metrics.bookedNights).toBeGreaterThanOrEqual(159_000);
    expect(metrics.nightlyRate * metrics.bookedNights).toBeLessThanOrEqual(161_000);
  });
});

describe("estimateAtRevenue", () => {
  const points = extractPercentileKpis({ kpis: KIRRA_KPIS });
  const coogeeComps = [
    { bedrooms: 4, annual_revenue_ltm: 219231, avg_occupancy_rate_ltm: 79 },
    { bedrooms: 4, annual_revenue_ltm: 215290, avg_occupancy_rate_ltm: 61 },
    { bedrooms: 4, annual_revenue_ltm: 172806, avg_occupancy_rate_ltm: 58 },
    { bedrooms: 4, annual_revenue_ltm: 134044, avg_occupancy_rate_ltm: 79 },
    { bedrooms: 4, annual_revenue_ltm: 133869, avg_occupancy_rate_ltm: 64 },
    { bedrooms: 4, annual_revenue_ltm: 107748, avg_occupancy_rate_ltm: 82 },
    { bedrooms: 4, annual_revenue_ltm: 52848, avg_occupancy_rate_ltm: 31 },
    { bedrooms: 4, annual_revenue_ltm: 27147, avg_occupancy_rate_ltm: 51 },
  ];

  it("builds a consistent estimate at a target revenue", () => {
    const positioned = estimateAtRevenue(baseEstimate({ kpis: KIRRA_KPIS }), points, 85000);
    expect(positioned.annualRevenue).toBe(85000);
    expect(positioned.monthlyRevenue).toBe(Math.round(85000 / 12));
    expect(positioned.nightlyRate! * positioned.bookedNights!).toBeGreaterThanOrEqual(84_000);
    expect(positioned.nightlyRate! * positioned.bookedNights!).toBeLessThanOrEqual(86_000);
  });

  it("does not pair comp-positioned revenue with inflated KPI ADR/occupancy", () => {
    const positioned = estimateAtRevenue(
      baseEstimate({
        kpis: {
          "25": { ltm_revenue: 194384, ltm_nightly_rate: 634, ltm_occupancy_rate: 84 },
          "50": { ltm_revenue: 259352, ltm_nightly_rate: 793, ltm_occupancy_rate: 90 },
          "75": { ltm_revenue: 391368, ltm_nightly_rate: 1094, ltm_occupancy_rate: 98 },
          "90": { ltm_revenue: 521220, ltm_nightly_rate: 1457, ltm_occupancy_rate: 98 },
        },
      }),
      extractPercentileKpis({
        kpis: {
          "25": { ltm_revenue: 194384, ltm_nightly_rate: 634, ltm_occupancy_rate: 84 },
          "50": { ltm_revenue: 259352, ltm_nightly_rate: 793, ltm_occupancy_rate: 90 },
          "75": { ltm_revenue: 391368, ltm_nightly_rate: 1094, ltm_occupancy_rate: 98 },
          "90": { ltm_revenue: 521220, ltm_nightly_rate: 1457, ltm_occupancy_rate: 98 },
        },
      }),
      160_000,
      { comps: coogeeComps, subjectBedrooms: 4 },
    );

    expect(positioned.annualRevenue).toBe(160_000);
    expect(positioned.occupancyRate).not.toBe(84);
    expect(positioned.nightlyRate).not.toBe(634);
    expect(positioned.nightlyRate! * positioned.bookedNights!).toBeGreaterThanOrEqual(159_000);
    expect(positioned.nightlyRate! * positioned.bookedNights!).toBeLessThanOrEqual(161_000);
  });
});

describe("positionStrEstimate deterministic fallback", () => {
  it("uses same-bed comp anchors when model review is unavailable", async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const estimate = baseEstimate({
        kpis: KIRRA_KPIS,
        comps: [
          { bedrooms: 2, annual_revenue_ltm: 80_000, avg_occupancy_rate_ltm: 68, distance: 80 },
          { bedrooms: 2, annual_revenue_ltm: 100_000, avg_occupancy_rate_ltm: 72, distance: 120 },
          { bedrooms: 2, annual_revenue_ltm: 120_000, avg_occupancy_rate_ltm: 74, distance: 160 },
          { bedrooms: 2, annual_revenue_ltm: 140_000, avg_occupancy_rate_ltm: 76, distance: 220 },
        ],
      });

      const positioned = await positionStrEstimate({
        subject: {
          property_address: "1 Test Street",
          suburb: "Test Beach",
          state: "QLD",
          property_type: "Apartment",
          bedrooms: 2,
          bathrooms: 2,
          listing_title: "Renovated beach apartment",
          listing_description: "Premium renovated apartment near the beach.",
          display_price: "$1,000,000",
        },
        estimate,
      });

      expect(positioned.positioning).not.toBeNull();
      expect(positioned.positioning?.llm_annual_revenue).toBeNull();
      expect(positioned.estimate.annualRevenue).toBeGreaterThan(
        estimate.annualRevenue ?? 0,
      );
      expect(positioned.estimate.monthlyRevenue).toBe(
        Math.round((positioned.estimate.annualRevenue ?? 0) / 12),
      );
    } finally {
      if (originalOpenAiKey) {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
    }
  });
});

describe("deriveCompAwareBounds", () => {
  it("caps ceiling near same-bedroom comp evidence when KPI median is inflated", () => {
    const bounds = deriveCompAwareBounds({
      sameBedCount: 8,
      sameBedMin: 27147,
      sameBedMedian: 133957,
      sameBedP75: 183058,
      sameBedMax: 219231,
      nearbySameBedMax: null,
      kpiP50: 259352,
      kpiP75: 391368,
      kpiP90: 521220,
    });

    expect(bounds.ceiling).toBeLessThanOrEqual(Math.round(219231 * 1.08));
    expect(bounds.ceiling).toBeGreaterThan(170000);
    expect(bounds.floor).toBeGreaterThan(25000);
  });

  it("never sets ceiling below the calibrated target", () => {
    const bounds = deriveCompAwareBounds({
      sameBedCount: 24,
      sameBedMin: 40781,
      sameBedMedian: 39662,
      sameBedP75: 50483,
      sameBedMax: 92950,
      nearbySameBedMax: 92950,
      kpiP50: 58486,
      kpiP75: 74393,
      kpiP90: 95179,
    });

    expect(bounds.target).toBeGreaterThan(55000);
    expect(bounds.ceiling).toBeGreaterThanOrEqual(bounds.target!);
  });

  it("lifts conservative LLM picks when nearby same-bed tail supports premium target", () => {
    const anchors = buildCompAnchors(
      [
        { bedrooms: 2, annual_revenue_ltm: 92950, distance: 98 },
        { bedrooms: 2, annual_revenue_ltm: 59112, distance: 145 },
        { bedrooms: 2, annual_revenue_ltm: 54684, distance: 71 },
        { bedrooms: 2, annual_revenue_ltm: 49638, distance: 19 },
        { bedrooms: 2, annual_revenue_ltm: 43322, distance: 19 },
        { bedrooms: 2, annual_revenue_ltm: 42156, distance: 24 },
      ],
      2,
      extractPercentileKpis({
        kpis: {
          "25": { ltm_revenue: 43347 },
          "50": { ltm_revenue: 58486 },
          "75": { ltm_revenue: 74393 },
          "90": { ltm_revenue: 95179 },
        },
      }),
    );

    const resolved = resolvePositionedAnnualRevenue(56000, anchors);
    expect(resolved.annualRevenue).toBeGreaterThanOrEqual(
      anchors.suggested_target ?? 0,
    );
  });

  it("clamps an aggressive LLM revenue pick to the comp-aware ceiling", () => {
    const anchors = buildCompAnchors(
      [
        { bedrooms: 4, annual_revenue_ltm: 219231, distance: 1260 },
        { bedrooms: 4, annual_revenue_ltm: 215290, distance: 1081 },
        { bedrooms: 4, annual_revenue_ltm: 172806, distance: 614 },
        { bedrooms: 4, annual_revenue_ltm: 134044, distance: 442 },
        { bedrooms: 4, annual_revenue_ltm: 133869, distance: 1050 },
        { bedrooms: 4, annual_revenue_ltm: 107748, distance: 1190 },
        { bedrooms: 4, annual_revenue_ltm: 52848, distance: 152 },
        { bedrooms: 4, annual_revenue_ltm: 27147, distance: 412 },
      ],
      4,
      extractPercentileKpis({
        kpis: {
          "25": { ltm_revenue: 194384 },
          "50": { ltm_revenue: 259352 },
          "75": { ltm_revenue: 391368 },
          "90": { ltm_revenue: 521220 },
        },
      }),
    );

    const clamped = clampPositionedAnnualRevenue(354404, anchors);
    expect(clamped.wasClamped).toBe(true);
    expect(clamped.annualRevenue).toBeLessThanOrEqual(
      anchors.suggested_ceiling ?? Number.MAX_SAFE_INTEGER,
    );
    expect(clamped.annualRevenue).toBeLessThan(250000);
  });
});
