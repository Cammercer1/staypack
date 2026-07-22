import { describe, expect, it } from "vitest";
import {
  buildSaleCompAnchors,
  clampPositionedSaleBand,
  deriveSaleCompAwareBounds,
} from "@/lib/sales/positionSalesAppraisal";
import type { SaleComp } from "@/lib/sales/types";

const PREMIUM_COMPS: SaleComp[] = [
  { address: "1 Example St", suburb: "Example", price: 650_000, saleStatus: "sold", bedrooms: 4 },
  { address: "2 Example St", suburb: "Example", price: 800_000, saleStatus: "sold", bedrooms: 4 },
  { address: "3 Example St", suburb: "Example", price: 860_000, saleStatus: "sold", bedrooms: 4 },
  { address: "4 Example St", suburb: "Example", price: 995_000, saleStatus: "sold", bedrooms: 4 },
  { address: "5 Example St", suburb: "Example", price: 1_095_000, saleStatus: "sold", bedrooms: 4 },
  { address: "6 Example St", suburb: "Example", price: 1_431_000, saleStatus: "sold", bedrooms: 4 },
];

describe("deriveSaleCompAwareBounds", () => {
  it("never produces a premium ceiling below its target or strongest comp", () => {
    const bounds = deriveSaleCompAwareBounds({
      sameBedCount: 17,
      sameBedMin: 650_000,
      sameBedMedian: 860_000,
      sameBedP75: 990_000,
      sameBedMax: 1_431_000,
      premiumTier: true,
      statisticalMid: 855_000,
    });

    expect(bounds.ceiling).toBeGreaterThanOrEqual(bounds.target!);
    expect(bounds.ceiling).toBeGreaterThanOrEqual(1_431_000);
  });
});

describe("clampPositionedSaleBand", () => {
  it("does not clamp a credible premium recommendation below the best comp", () => {
    const anchors = buildSaleCompAnchors(PREMIUM_COMPS, 4, true);
    const { band } = clampPositionedSaleBand(
      {
        priceMin: 1_180_000,
        priceMidpoint: 1_265_000,
        priceMax: 1_350_000,
      },
      anchors,
    );

    expect(anchors.suggested_ceiling).toBeGreaterThanOrEqual(1_431_000);
    expect(band.priceMax).toBe(1_350_000);
  });
});
