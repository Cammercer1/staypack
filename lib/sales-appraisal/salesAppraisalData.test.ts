import { describe, expect, it } from "vitest";
import { applySalesAppraisalCompSelection } from "@/lib/sales-appraisal/salesAppraisalData";
import type { ParsedListing } from "@/lib/types";

function parsedWithSalesComps(count: number): ParsedListing {
  return {
    address: "1/32-38 Dutruc Street, Randwick",
    suburb: "Randwick",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    images: [],
    agents: [],
    confidence: "high",
    warnings: [],
    salesComps: Array.from({ length: count }, (_, index) => ({
      address: `${index + 1}/10 Example Street, Randwick`,
      suburb: "Randwick",
      propertyType: "apartment",
      price: 2_000_000 + index * 25_000,
      saleStatus: "sold" as const,
      soldDate: "2026-06-01",
      listingUrl: `https://example.com/sale-${index}`,
    })),
  };
}

describe("applySalesAppraisalCompSelection", () => {
  it("keeps candidate pool count separate from the six featured comps", () => {
    const parsed = parsedWithSalesComps(18);
    const selected = Array.from(
      { length: 6 },
      (_, index) => `https://example.com/sale-${index}`,
    );

    const result = applySalesAppraisalCompSelection(parsed, selected);

    expect(result.salesAppraisal?.compCount).toBe(18);
    expect(result.salesAppraisal?.featuredCompCount).toBe(6);
    expect(result.salesAppraisal?.selectedCompListingIds).toHaveLength(6);
  });
});
