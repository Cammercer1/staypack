import { describe, expect, it } from "vitest";
import {
  filterSaleCompsForSubjectType,
  resolveSaleCompPropertyType,
  resolveSaleSubjectPropertyType,
} from "@/lib/sales/rankSaleCompsForSubject";
import type { ParsedListing } from "@/lib/types";
import type { SaleComp } from "@/lib/sales/types";

function comp(propertyType: string): SaleComp {
  return {
    address: "24/11-17 Walkerville Terrace, Gilberton",
    price: 500_000,
    saleStatus: "sold",
    soldDate: "2026-07-01",
    propertyType,
  };
}

describe("sales comparable property types", () => {
  it("preserves an explicitly declared townhouse despite a strata-style address", () => {
    const townhouse = comp("Townhouse");
    const subject: ParsedListing = {
      address: townhouse.address,
      propertyType: "Townhouse",
      images: [],
      agents: [],
      confidence: "high",
      warnings: [],
    };

    expect(resolveSaleCompPropertyType(townhouse)).toBe("Townhouse");
    expect(resolveSaleSubjectPropertyType(subject)).toBe("Townhouse");
  });

  it("never falls back to apartments or units for a townhouse", () => {
    const townhouse = comp("Townhouse");
    expect(
      filterSaleCompsForSubjectType(
        [townhouse, comp("Apartment"), comp("Unit")],
        "Townhouse",
      ),
    ).toEqual([townhouse]);
    expect(
      filterSaleCompsForSubjectType([comp("Apartment"), comp("Unit")], "Townhouse"),
    ).toEqual([]);
  });
});
