import { describe, expect, it } from "vitest";
import { resolveSuburbRentFloor } from "@/lib/rental/resolveSuburbRentFloor";

describe("resolveSuburbRentFloor", () => {
  it("uses bedroom-matched Apify REA evidence", () => {
    expect(
      resolveSuburbRentFloor({
        reaBedMedian: 850,
        reaBedP75: 950,
        suburbMarket: null,
        bedrooms: 2,
        premium: false,
      }),
    ).toEqual({
      weeklyRent: 850,
      source: "rea_bed_median",
    });
  });

  it("uses the REA upper quartile for premium properties", () => {
    expect(
      resolveSuburbRentFloor({
        reaBedMedian: 850,
        reaBedP75: 950,
        suburbMarket: null,
        bedrooms: 2,
        premium: true,
      }),
    ).toEqual({
      weeklyRent: 950,
      source: "rea_bed_median",
    });
  });
});
