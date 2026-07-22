import { describe, expect, it } from "vitest";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
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

describe("resolveRentSubjectPropertyType", () => {
  it("preserves a declared townhouse with a strata-style address", () => {
    expect(
      resolveRentSubjectPropertyType(
        listing({
          address: "24/11-17 Walkerville Terrace, Gilberton",
          propertyType: "townhouse",
        }),
      ),
    ).toBe("townhouse");
  });

  it("infers a unit when the address is unit-style and no type is declared", () => {
    expect(
      resolveRentSubjectPropertyType(
        listing({ address: "5/10 Example Street, Adelaide" }),
      ),
    ).toBe("Unit");
  });

  it("does not treat a certificate-of-title reference as a unit address", () => {
    expect(
      resolveRentSubjectPropertyType(
        listing({
          address: "20 Joy Street, Encounter Bay",
          propertyType: "house",
          description: "CT - 5451/654\nCouncil - Victor Harbor",
        }),
      ),
    ).toBe("house");
  });

  it("does not infer a unit from description-only number slashes", () => {
    expect(
      resolveRentSubjectPropertyType(
        listing({
          address: "20 Joy Street, Encounter Bay",
          description: "CT - 5451/654\nCouncil - Victor Harbor",
        }),
      ),
    ).toBeUndefined();
  });
});
