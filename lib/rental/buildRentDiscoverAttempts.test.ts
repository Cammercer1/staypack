import { describe, expect, it } from "vitest";
import { buildRentDiscoverAttempts } from "@/lib/rental/buildRentDiscoverAttempts";
import { parseListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import type { ParsedListing } from "@/lib/types";

function listing(overrides: Partial<ParsedListing>): ParsedListing {
  return {
    images: [],
    agents: [],
    confidence: "medium",
    warnings: [],
    ...overrides,
  };
}

describe("buildRentDiscoverAttempts", () => {
  it("keeps a declared house on house searches when legal copy contains a slash", () => {
    const subject = listing({
      address: "20 Joy Street, Encounter Bay",
      suburb: "Encounter Bay",
      state: "SA",
      postcode: "5211",
      propertyType: "house",
      bedrooms: 3,
      bathrooms: 2,
      carSpaces: 2,
      description: "CT - 5451/654\nCouncil - Victor Harbor",
    });

    const attempts = buildRentDiscoverAttempts(
      subject,
      parseListingPremiumSignals(subject),
    );

    expect(attempts[0]?.searchUrl).toContain("property-house-with-3-bedrooms");
    expect(attempts.every((attempt) => attempt.input.propertyType === "house")).toBe(
      true,
    );
    expect(
      attempts.every((attempt) => !attempt.searchUrl.includes("property-unit+apartment")),
    ).toBe(true);
  });
});
