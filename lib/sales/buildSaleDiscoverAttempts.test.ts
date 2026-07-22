import { describe, expect, it } from "vitest";
import { buildSaleDiscoverAttemptsForChannel } from "@/lib/sales/buildSaleDiscoverAttempts";
import { parseListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import type { ParsedListing } from "@/lib/types";

describe("sales discovery attempts", () => {
  it("keeps an explicit townhouse type for a strata-style address", () => {
    const listing: ParsedListing = {
      address: "24/11-17 Walkerville Terrace, Gilberton",
      suburb: "Gilberton",
      state: "SA",
      postcode: "5081",
      propertyType: "Townhouse",
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      images: [],
      agents: [],
      confidence: "high",
      warnings: [],
    };

    const attempts = buildSaleDiscoverAttemptsForChannel(
      listing,
      parseListingPremiumSignals(listing),
      "sold",
    );
    const typed = attempts.filter(
      (attempt) => !attempt.label.includes("adjacent-postcodes"),
    );

    expect(typed.length).toBeGreaterThan(0);
    expect(typed.every((attempt) => attempt.searchUrl.includes("property-townhouse"))).toBe(true);
    expect(typed.some((attempt) => /property-unit|property-apartment/.test(attempt.searchUrl))).toBe(false);
  });
});
