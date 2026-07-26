import { describe, expect, it } from "vitest";
import {
  filterRecentSaleComps,
  isRecentSoldComp,
  soldCompCutoff,
} from "@/lib/sales/saleCompFreshness";
import type { SaleComp } from "@/lib/sales/types";

const referenceDate = new Date("2026-07-21T12:00:00.000Z");

function sold(soldDate?: string): SaleComp {
  return {
    address: "1 Example Street",
    price: 500_000,
    saleStatus: "sold",
    soldDate,
    propertyType: "Townhouse",
  };
}

describe("sale comp freshness", () => {
  it("uses a rolling 12-month cutoff", () => {
    expect(soldCompCutoff(referenceDate).toISOString()).toBe(
      "2025-07-21T12:00:00.000Z",
    );
    expect(isRecentSoldComp(sold("2025-07-21T12:00:00.000Z"), referenceDate)).toBe(true);
    expect(isRecentSoldComp(sold("2025-07-20"), referenceDate)).toBe(false);
  });

  it("allows exact-address Domain AVM evidence up to 18 months", () => {
    expect(
      isRecentSoldComp(
        {
          ...sold("2025-02-01"),
          provider: "domain_avm",
        },
        referenceDate,
      ),
    ).toBe(true);
    expect(
      isRecentSoldComp(
        {
          ...sold("2025-01-20"),
          provider: "domain_avm",
        },
        referenceDate,
      ),
    ).toBe(false);
  });

  it("rejects sold records without a verifiable date", () => {
    expect(isRecentSoldComp(sold(), referenceDate)).toBe(false);
    expect(isRecentSoldComp(sold("not-a-date"), referenceDate)).toBe(false);
  });

  it("does not age-filter current for-sale context", () => {
    const current: SaleComp = {
      ...sold(),
      saleStatus: "for_sale",
      soldDate: undefined,
    };
    expect(filterRecentSaleComps([sold("2023-01-01"), current], referenceDate)).toEqual([
      current,
    ]);
  });
});
