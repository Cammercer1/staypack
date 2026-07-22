import { describe, expect, it } from "vitest";
import {
  reportableSaleArea,
  reportableSaleLandArea,
} from "@/lib/sales/reportableSaleArea";

describe("reportable sales area", () => {
  it.each(["Apartment", "Unit", "Townhouse"])(
    "suppresses land size for %s stock",
    (propertyType) => {
      expect(reportableSaleLandArea(propertyType, 63)).toBeNull();
      expect(
        reportableSaleArea({ propertyType, landAreaSqm: 63 }),
      ).toBeNull();
    },
  );

  it("shows genuine floor area for attached stock", () => {
    expect(
      reportableSaleArea({
        propertyType: "Townhouse",
        landAreaSqm: 63,
        floorAreaSqm: 118,
      }),
    ).toEqual({ kind: "floor", value: 118 });
  });

  it("retains land size for houses", () => {
    expect(
      reportableSaleArea({ propertyType: "House", landAreaSqm: 970 }),
    ).toEqual({ kind: "land", value: 970 });
  });
});
