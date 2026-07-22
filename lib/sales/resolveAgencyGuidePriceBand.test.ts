import { describe, expect, it } from "vitest";
import {
  applyAgencyGuideToCompBand,
  resolveAgencyGuidePriceBand,
  reviewAgencyGuideAgainstCompBand,
} from "@/lib/sales/resolveAgencyGuidePriceBand";

describe("resolveAgencyGuidePriceBand", () => {
  it("preserves an explicit agency range", () => {
    expect(resolveAgencyGuidePriceBand("$2,000,000 – $2,200,000")).toEqual({
      displayPrice: "$2,000,000 – $2,200,000",
      priceMin: 2_000_000,
      priceMax: 2_200_000,
      priceMidpoint: 2_100_000,
    });
  });

  it("accepts a single numeric guide and rejects weekly rent", () => {
    expect(resolveAgencyGuidePriceBand("Guide $1.5m")).toMatchObject({
      priceMin: 1_500_000,
      priceMax: 1_500_000,
      priceMidpoint: 1_500_000,
    });
    expect(resolveAgencyGuidePriceBand("$850 per week")).toBeNull();
  });
});

describe("reviewAgencyGuideAgainstCompBand", () => {
  it("requires explicit review when the comp midpoint materially conflicts", () => {
    const agencyGuide = resolveAgencyGuidePriceBand(
      "$2,000,000 – $2,200,000",
    );
    expect(agencyGuide).not.toBeNull();

    const review = reviewAgencyGuideAgainstCompBand({
      agencyGuide: agencyGuide!,
      compBand: {
        priceMin: 1_180_000,
        priceMax: 1_350_000,
        priceMidpoint: 1_265_000,
        compCount: 17,
      },
      premiumTier: true,
    });

    expect(review.required).toBe(true);
    expect(review.confirmed).toBe(false);
    expect(review.divergencePct).toBeGreaterThan(0.25);
    expect(review.reasons).toHaveLength(2);
  });

  it("does not require review when the evidence broadly supports the guide", () => {
    const agencyGuide = resolveAgencyGuidePriceBand(
      "$2,000,000 – $2,200,000",
    );

    const review = reviewAgencyGuideAgainstCompBand({
      agencyGuide: agencyGuide!,
      compBand: {
        priceMin: 1_900_000,
        priceMax: 2_150_000,
        priceMidpoint: 2_025_000,
        compCount: 12,
      },
      premiumTier: false,
    });

    expect(review.required).toBe(false);
  });
});

describe("applyAgencyGuideToCompBand", () => {
  it("uses the agency's explicit range while retaining a review of comp divergence", () => {
    const result = applyAgencyGuideToCompBand({
      displayPrice: "$2,000,000 – $2,200,000",
      compBand: {
        priceMin: 1_180_000,
        priceMax: 1_350_000,
        priceMidpoint: 1_265_000,
        compCount: 17,
      },
      premiumTier: true,
    });

    expect(result.band).toMatchObject({
      priceMin: 2_000_000,
      priceMax: 2_200_000,
      priceMidpoint: 2_100_000,
      compCount: 17,
    });
    expect(result.review?.required).toBe(true);
  });
});
