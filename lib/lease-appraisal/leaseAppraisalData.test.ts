import { describe, expect, it } from "vitest";
import { applyLeaseAppraisalCompSelection } from "@/lib/lease-appraisal/leaseAppraisalData";
import type { ParsedListing } from "@/lib/types";

function parsedWithRentalComps(count: number): ParsedListing {
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
    rentalComps: Array.from({ length: count }, (_, index) => ({
      address: `${index + 1}/10 Example Street, Randwick`,
      suburb: "Randwick",
      propertyType: "apartment",
      weeklyRent: 900 + index * 10,
      listingUrl: `https://example.com/rent-${index}`,
    })),
  };
}

describe("applyLeaseAppraisalCompSelection", () => {
  it("keeps candidate pool count separate from the six featured comps", () => {
    const parsed = parsedWithRentalComps(18);
    const selected = Array.from(
      { length: 6 },
      (_, index) => `https://example.com/rent-${index}`,
    );

    const result = applyLeaseAppraisalCompSelection(parsed, selected);

    expect(result.rentalAppraisal?.compCount).toBe(18);
    expect(result.rentalAppraisal?.featuredCompCount).toBe(6);
    expect(result.rentalAppraisal?.selectedCompListingIds).toHaveLength(6);
  });
});
