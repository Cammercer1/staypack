import { describe, expect, it } from "vitest";
import { applyLeaseAppraisalCompSelection, defaultSelectedCompListingIds, orderLeaseAppraisalCompPool, resolveSelectedRentalComps } from "@/lib/lease-appraisal/leaseAppraisalData";
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
  it("retains saved relisting selections as one canonical property", () => {
    const parsed = parsedWithRentalComps(6);
    const first = parsed.rentalComps![0]!;
    parsed.rentalComps!.push({ ...first, listingUrl: "https://example.com/relisted" });
    const result = applyLeaseAppraisalCompSelection(parsed, [first.listingUrl!, "https://example.com/relisted"]);
    expect(result.rentalAppraisal?.selectedCompListingIds).toEqual([first.listingUrl]);
    expect(orderLeaseAppraisalCompPool(result)).toHaveLength(6);
    expect(resolveSelectedRentalComps(result)).toHaveLength(1);
  });
  it("prioritises local matching properties over cheaper nearby properties", () => {
    const parsed = parsedWithRentalComps(6);
    parsed.domainAvm = { rentalEstimate: { weeklyRent: 565, confidence: "high" } } as ParsedListing["domainAvm"];
    parsed.rentalComps!.push(...[600, 610, 640, 670].map((weeklyRent, i) => ({
      ...parsed.rentalComps![0]!, address: `${i + 1}/20 Nearby Street`, suburb: "Another suburb", weeklyRent, listingUrl: `https://example.com/nearby-${i}`,
    })));
    expect(defaultSelectedCompListingIds(parsed)).toEqual(expect.arrayContaining(Array.from({ length: 6 }, (_, i) => `https://example.com/rent-${i}`)));
  });
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
