import { describe, expect, it } from "vitest";
import { mergeRentalComps } from "./mergeRentalComps";
import type { RentalComp } from "./types";

const original: RentalComp = { address: "2/267 Condamine Street,, Manly Vale", suburb: "Manly Vale", bedrooms: 1, bathrooms: 1, weeklyRent: 700, listingUrl: "https://example.test/445253628" };
describe("rental property deduplication", () => {
  it("counts a relisted property once even with a different price and listing ID", () => {
    const relisted = { ...original, address: " 2/267 Condamine Street, MANLY VALE ", weeklyRent: 720, listingUrl: "https://example.test/445250184" };
    expect(mergeRentalComps([original, relisted], [relisted])).toEqual([original]);
  });
  it("keeps separate units, street numbers and suburbs", () => {
    const others = [
      { ...original, address: "3/267 Condamine Street", listingUrl: "https://example.test/3" },
      { ...original, address: "2/268 Condamine Street", listingUrl: "https://example.test/4" },
      { ...original, address: "2/267 Condamine Street", suburb: "Manly", listingUrl: "https://example.test/5" },
    ];
    expect(mergeRentalComps([original], others)).toHaveLength(4);
  });
  it("falls back to listing IDs for incomplete property addresses", () => {
    expect(mergeRentalComps([], [
      { ...original, address: "Address withheld" },
      { ...original, address: "Address withheld", listingUrl: "https://example.test/other" },
    ])).toHaveLength(2);
  });
});
