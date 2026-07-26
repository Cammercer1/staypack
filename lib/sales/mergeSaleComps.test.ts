import { describe, expect, it } from "vitest";
import { mergeSaleComps } from "@/lib/sales/mergeSaleComps";
import type { SaleComp } from "@/lib/sales/types";

function comp(
  address: string,
  listingUrl: string,
  provider?: SaleComp["provider"],
): SaleComp {
  return {
    address,
    suburb: "Randwick",
    price: 890_000,
    saleStatus: "sold",
    soldDate: "2026-01-01",
    bedrooms: 2,
    bathrooms: 2,
    carSpaces: 1,
    propertyType: "Apartment",
    listingUrl,
    provider,
  };
}

describe("mergeSaleComps", () => {
  it("deduplicates the same sale across Domain and REA address formats", () => {
    const domain = comp(
      "21/57 BELMORE ROAD, RANDWICK, NSW 2031",
      "https://www.domain.com.au/property-profile/21-57-63-belmore-road-randwick-nsw-2031",
      "domain_avm",
    );
    const rea = comp(
      "21/57-63 Belmore Road, Randwick",
      "https://www.realestate.com.au/property-apartment-nsw-randwick-149883888",
    );

    expect(mergeSaleComps([domain], [rea])).toEqual([domain]);
  });
});
