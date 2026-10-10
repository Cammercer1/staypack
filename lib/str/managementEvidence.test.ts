import { expect, it } from "vitest";
import { managementEvidenceSummary } from "./managementEvidence";
import type { StrCompCard } from "@/lib/types";

it("uses matching managed properties, handles missing data, and reports thin evidence honestly", () => {
  const comp = { bedrooms: 3, property_type: "apartment", professional_management: true, annual_revenue: 60000 } as StrCompCard;
  const pool = [comp, { ...comp, annual_revenue: 90000 }, { ...comp, bedrooms: 4, annual_revenue: 200000 }, { ...comp, property_type: "house" }, { ...comp, professional_management: null }, { ...comp, annual_revenue: null }];
  expect(managementEvidenceSummary(pool, { bedrooms: 3, property_type: "unit" }, 80000)).toEqual({ count: 3, revenueCount: 2, median: 75000, atOrAbove: 1, limited: true });
  expect(managementEvidenceSummary(pool, { bedrooms: 3, property_type: null }, null)).toEqual({ count: 0, revenueCount: 0, median: null, atOrAbove: null, limited: true });
  expect(managementEvidenceSummary([...pool, { ...comp, annual_revenue: 100000 }], { bedrooms: 3, property_type: "unit" }, 80000)).toMatchObject({ median: 90000, revenueCount: 3, atOrAbove: 2, limited: false });
});
