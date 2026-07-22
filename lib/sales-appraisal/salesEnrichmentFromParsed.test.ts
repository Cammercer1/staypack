import { describe, expect, it } from "vitest";
import { salesEnrichmentFromParsed } from "@/lib/sales-appraisal/salesEnrichmentFromParsed";
import type { ParsedListing } from "@/lib/types";

describe("salesEnrichmentFromParsed", () => {
  it("carries comparable property facts into final report comps", () => {
    const parsed: ParsedListing = {
      images: [],
      agents: [],
      confidence: "high",
      warnings: [],
      salesAppraisal: {
        priceMin: 800_000,
        priceMidpoint: 850_000,
        priceMax: 900_000,
      },
      salesComps: [
        {
          address: "13 Sussex Crescent, Morphett Vale",
          price: 849_000,
          saleStatus: "sold",
          soldDate: "2026-06-18",
          landAreaSqm: 970,
          floorAreaSqm: 184,
          carSpaces: 6,
          propertyType: "House",
        },
      ],
    };

    expect(salesEnrichmentFromParsed(parsed)?.comps[0]).toMatchObject({
      sold_date: "2026-06-18",
      land_area_sqm: 970,
      floor_area_sqm: 184,
      car_spaces: 6,
      property_type: "House",
    });
  });
});
