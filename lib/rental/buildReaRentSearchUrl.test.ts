import { describe, expect, it } from "vitest";
import { adjacentRentSearchPostcodes } from "@/lib/rental/adjacentRentSearchPostcodes";
import { buildReaRentSearchUrl } from "@/lib/rental/buildReaRentSearchUrl";

describe("adjacentRentSearchPostcodes", () => {
  it("returns +/-1 postcodes for standard AU postcodes", () => {
    expect(adjacentRentSearchPostcodes("6020")).toEqual(["6019", "6021"]);
  });
});

describe("buildReaRentSearchUrl", () => {
  it("builds multi-postcode untyped SERP paths", () => {
    const url = buildReaRentSearchUrl(
      {
        suburb: "Sorrento",
        state: "WA",
        postcode: "6020",
        additionalPostcodes: ["6019", "6021"],
        bedrooms: 5,
        propertyType: "House",
      },
      { includePropertyTypeInPath: false },
    );

    expect(url).toContain("/rent/with-5-bedrooms-in-sorrento,+wa+6020;6019;6021/list-1");
    expect(url).not.toContain("property-house");
  });
});
