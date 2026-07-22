import { describe, expect, it } from "vitest";
import { mergeSaleCompDetailRecord } from "@/lib/sales/enrichSaleCompDetails";
import type { SaleComp } from "@/lib/sales/types";

const soldComp: SaleComp = {
  address: "13 Sussex Crescent, Morphett Vale",
  price: 849_000,
  saleStatus: "sold",
};

describe("mergeSaleCompDetailRecord", () => {
  it("adds property facts from a detail result", () => {
    expect(
      mergeSaleCompDetailRecord(soldComp, {
        channel: "sold",
        soldDate: "2026-06-18",
        landSize: 970,
        floorArea: "184 m²",
        carSpaces: 6,
        propertyType: "House",
      }),
    ).toMatchObject({
      soldDate: "2026-06-18",
      landAreaSqm: 970,
      floorAreaSqm: 184,
      carSpaces: 6,
      propertyType: "House",
    });
  });

  it("preserves existing facts when the detail result omits them", () => {
    expect(
      mergeSaleCompDetailRecord(
        { ...soldComp, soldDate: "2025-01-01", landAreaSqm: 500 },
        { listing_type: "sold" },
      ),
    ).toMatchObject({
      soldDate: "2025-01-01",
      landAreaSqm: 500,
    });
  });

  it("does not attach a sold date to a current listing", () => {
    expect(
      mergeSaleCompDetailRecord(
        { ...soldComp, saleStatus: "for_sale" },
        { sold_date: "2025-01-01" },
      ).soldDate,
    ).toBeUndefined();
  });
});
