import { expect, it } from "vitest";
import { deriveSaleComparableEvidence } from "./comparableEvidenceCopy";

it("does not turn Tower Street flooring, high ceilings and building size into elevation", () => {
  const copy = deriveSaleComparableEvidence({ suburb: "Manly", bedrooms: 1, bathrooms: 1, carSpaces: 0,
    description: "High quality renovations, high ceilings and engineered timber flooring. Gorgeous building of 12. Private rear setting, 42sqm internally, minimal entry stairs.",
    soldCompCount: 26, forSaleCompCount: 4, priceMin: 835000, priceMax: 925000,
    featuredComps: [{ price: 868500, sale_status: "sold" }, { price: 900000, sale_status: "sold" }] });
  expect(copy).toContain("between $868,500 and $900,000");
  expect(copy).toContain("estimated sale price range of $835,000 to $925,000");
  expect(copy).not.toMatch(/elevated|secure car|reasonable in the current market/);
});
