import { describe, expect, it } from "vitest";
import {
  resolveReaFloorAreaSqm,
  resolveReaLandAreaSqm,
  resolveReaSoldDate,
} from "@/lib/scraping/rea/parseReaPropertyFacts";

describe("REA property fact parsing", () => {
  it("finds sold dates in flat and nested provider payloads", () => {
    expect(resolveReaSoldDate({ dateSold: "2026-06-18" })).toBe("2026-06-18");
    expect(
      resolveReaSoldDate({ listing: { saleDetails: { sold_date: "18 Jun 2026" } } }),
    ).toBe("18 Jun 2026");
  });

  it("normalizes structured land size values to square metres", () => {
    expect(resolveReaLandAreaSqm({ landSize: 970 })).toBe(970);
    expect(resolveReaLandAreaSqm({ land_area: { value: 0.12, unit: "ha" } })).toBe(
      1200,
    );
  });

  it("normalizes floor area strings and companion units", () => {
    expect(resolveReaFloorAreaSqm({ floorArea: "184 m²" })).toBe(184);
    expect(resolveReaFloorAreaSqm({ floor_size: 2152.78, floor_size_unit: "sq ft" })).toBe(
      200,
    );
  });

  it("does not mistake unrelated numbers for areas", () => {
    expect(resolveReaLandAreaSqm({ bedrooms: 4, price: 900_000 })).toBeUndefined();
    expect(resolveReaFloorAreaSqm({ bathrooms: 2 })).toBeUndefined();
  });
});
