import { describe, expect, it } from "vitest";
import {
  anchorRentBandToDomainAvm,
  anchorSaleBandToDomainAvm,
  domainAvmSaleComps,
  filterRentalCompsAroundDomainAvm,
  filterSaleCompsAroundDomainAvm,
} from "@/lib/domain-avm/appraisalEvidence";
import type { DomainAvm } from "@/lib/domain-avm/types";
import type { ParsedListing } from "@/lib/types";

function recentDate() {
  const value = new Date();
  value.setUTCMonth(value.getUTCMonth() - 2);
  return value.toISOString();
}

function avm(confidence: "low" | "medium" | "high" = "high"): DomainAvm {
  return {
    urlSlug: "4-12-14-belmore-road-randwick-nsw-2031",
    address: "4/12-14 Belmore Road, Randwick NSW 2031",
    propertyType: "Apartment",
    bedrooms: 2,
    bathrooms: 2,
    carSpaces: 0,
    floorAreaSqm: 85,
    valuation: {
      lowerPrice: 800_000,
      midPrice: 930_000,
      upperPrice: 1_060_000,
      confidence,
    },
    rentalEstimate: {
      weeklyRent: 885,
      confidence,
    },
    comparableSales: [
      {
        slug: "21-57-belmore-road-randwick-nsw-2031",
        address: "21/57 BELMORE RD, RANDWICK, NSW 2031",
        bedrooms: 2,
        bathrooms: 2,
        carSpaces: 1,
        soldDate: recentDate(),
        soldPrice: 890_000,
      },
      {
        slug: "620-65-belmore-road-randwick-nsw-2031",
        address: "620/65 BELMORE RD, RANDWICK, NSW 2031",
        bedrooms: 0,
        bathrooms: 1,
        carSpaces: 1,
        soldDate: recentDate(),
        soldPrice: 522_000,
      },
      {
        slug: "9-2-botany-street-randwick-nsw-2031",
        address: "9/2 BOTANY ST, RANDWICK, NSW 2031",
        bedrooms: 2,
        bathrooms: 2,
        carSpaces: 1,
        soldDate: recentDate(),
        soldPrice: 1_500_000,
      },
    ],
    matchedAt: new Date().toISOString(),
  };
}

const listing: ParsedListing = {
  address: "4/12-14 Belmore Road",
  suburb: "Randwick",
  state: "NSW",
  postcode: "2031",
  propertyType: "Apartment",
  bedrooms: 2,
  bathrooms: 2,
  carSpaces: 0,
  images: [],
  agents: [],
  confidence: "high",
  warnings: [],
};

describe("Domain AVM appraisal evidence", () => {
  it("keeps only recent, subject-like Domain sales near the AVM", () => {
    const comps = domainAvmSaleComps(avm(), listing);

    expect(comps).toHaveLength(1);
    expect(comps[0]).toMatchObject({
      price: 890_000,
      provider: "domain_avm",
      propertyType: "Apartment",
    });
  });

  it("anchors High-confidence sales and rental ranges", () => {
    expect(
      anchorSaleBandToDomainAvm(
        {
          priceMin: 1_750_000,
          priceMax: 1_900_000,
          priceMidpoint: 1_860_000,
          compCount: 20,
        },
        avm(),
      ),
    ).toMatchObject({
      priceMin: 885_000,
      priceMidpoint: 930_000,
      priceMax: 975_000,
    });

    expect(
      anchorRentBandToDomainAvm(
        {
          weeklyMin: 1_100,
          weeklyMax: 1_188,
          weeklyMidpoint: 1_144,
          compCount: 20,
          featuredComps: [],
        },
        avm(),
      ),
    ).toMatchObject({
      weeklyMin: 850,
      weeklyMidpoint: 885,
      weeklyMax: 920,
    });
  });

  it("does not let Low-confidence estimates override comp bands", () => {
    const saleBand = {
      priceMin: 1_750_000,
      priceMax: 1_900_000,
      priceMidpoint: 1_860_000,
      compCount: 20,
    };
    const rentBand = {
      weeklyMin: 1_100,
      weeklyMax: 1_188,
      weeklyMidpoint: 1_144,
      compCount: 20,
      featuredComps: [],
    };

    expect(anchorSaleBandToDomainAvm(saleBand, avm("low"))).toBe(saleBand);
    expect(anchorRentBandToDomainAvm(rentBand, avm("low"))).toBe(rentBand);
  });

  it("filters broad REA evidence around a trusted address anchor", () => {
    const saleComps = [800_000, 890_000, 930_000, 990_000, 1_900_000].map(
      (price, index) => ({
        address: `${index} Test Street`,
        price,
        saleStatus: "sold" as const,
        soldDate: recentDate(),
      }),
    );
    const rentalComps = [800, 850, 900, 950, 1_400].map(
      (weeklyRent, index) => ({
        address: `${index} Test Street`,
        weeklyRent,
      }),
    );

    expect(filterSaleCompsAroundDomainAvm(saleComps, avm())).not.toContain(
      saleComps.at(-1),
    );
    expect(filterRentalCompsAroundDomainAvm(rentalComps, avm())).not.toContain(
      rentalComps.at(-1),
    );
  });
});
