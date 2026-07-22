import { describe, expect, it } from "vitest";
import {
  buildRentCompAnchors,
  clampPositionedRentBand,
  deriveRentCompAwareBounds,
  normalizePositionedRentBand,
} from "@/lib/lease-appraisal/positionLeaseAppraisal";
import type { RentalComp } from "@/lib/rental/types";

const COMPS: RentalComp[] = [
  { address: "1 A St", suburb: "Coogee", weeklyRent: 1400, bedrooms: 4, bathrooms: 2 },
  { address: "2 B St", suburb: "Coogee", weeklyRent: 1500, bedrooms: 4, bathrooms: 3 },
  { address: "3 C St", suburb: "Coogee", weeklyRent: 1600, bedrooms: 4, bathrooms: 3 },
  { address: "4 D St", suburb: "Coogee", weeklyRent: 1550, bedrooms: 4, bathrooms: 2 },
  { address: "5 E St", suburb: "Coogee", weeklyRent: 1700, bedrooms: 4, bathrooms: 4 },
  { address: "6 F St", suburb: "Randwick", weeklyRent: 1200, bedrooms: 3, bathrooms: 2 },
];

describe("buildRentCompAnchors", () => {
  it("derives same-bedroom anchors from comps", () => {
    const anchors = buildRentCompAnchors(COMPS, 4, false);
    expect(anchors.same_bed_count).toBe(5);
    expect(anchors.same_bed_min).toBe(1400);
    expect(anchors.same_bed_max).toBe(1700);
    expect(anchors.suggested_target).toBeGreaterThan(1400);
    expect(anchors.suggested_ceiling).toBeLessThanOrEqual(Math.round(1700 * 1.08));
  });
});

describe("deriveRentCompAwareBounds", () => {
  it("falls back to statistical mid when too few same-bed comps", () => {
    const bounds = deriveRentCompAwareBounds({
      sameBedCount: 1,
      sameBedMin: 1400,
      sameBedMedian: 1400,
      sameBedP75: 1400,
      sameBedMax: 1400,
      premiumTier: false,
      statisticalMid: 1500,
    });
    expect(bounds.target).toBe(1500);
    expect(bounds.floor).toBeLessThan(1500);
    expect(bounds.ceiling).toBeGreaterThan(1500);
  });

  it("never produces a premium ceiling below its target or strongest comp", () => {
    const bounds = deriveRentCompAwareBounds({
      sameBedCount: 13,
      sameBedMin: 550,
      sameBedMedian: 600,
      sameBedP75: 660,
      sameBedMax: 1200,
      premiumTier: true,
      statisticalMid: 600,
    });

    expect(bounds.ceiling).toBeGreaterThanOrEqual(bounds.target!);
    expect(bounds.ceiling).toBeGreaterThanOrEqual(1200);
  });
});

describe("clampPositionedRentBand", () => {
  it("clamps an aggressive LLM band to comp anchors", () => {
    const anchors = buildRentCompAnchors(COMPS, 4, false);
    const { band, wasClamped } = clampPositionedRentBand(
      { weeklyMin: 1100, weeklyMidpoint: 2000, weeklyMax: 2200 },
      anchors,
    );

    expect(wasClamped).toBe(true);
    expect(band.weeklyMin).toBeGreaterThanOrEqual(anchors.suggested_floor!);
    expect(band.weeklyMax).toBeLessThanOrEqual(anchors.suggested_ceiling!);
    expect(band.weeklyMin).toBeLessThanOrEqual(band.weeklyMidpoint);
    expect(band.weeklyMidpoint).toBeLessThanOrEqual(band.weeklyMax);
  });
});

describe("normalizePositionedRentBand", () => {
  it("orders min/mid/max and caps spread", () => {
    const band = normalizePositionedRentBand({
      weeklyMin: 1600,
      weeklyMidpoint: 1400,
      weeklyMax: 1500,
    });
    expect(band.weeklyMin).toBeLessThanOrEqual(band.weeklyMidpoint);
    expect(band.weeklyMidpoint).toBeLessThanOrEqual(band.weeklyMax);
  });
});
