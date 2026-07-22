import { describe, expect, it } from "vitest";
import {
  buildRentalCompSelectionPool,
  rentalCompSelectionTier,
} from "@/lib/rental/rankRentalCompsForSubject";
import { resolveRentalCompPropertyType } from "@/lib/rental/resolveRentalCompPropertyType";
import type { RentalComp } from "@/lib/rental/types";

function comp(
  address: string,
  propertyType: string,
  weeklyRent: number,
  suburb = "Gilberton",
): RentalComp {
  return {
    address,
    propertyType,
    weeklyRent,
    suburb,
    bedrooms: 2,
    bathrooms: 1,
    carSpaces: 1,
  };
}

describe("buildRentalCompSelectionPool", () => {
  it("keeps explicit slash-address townhouses as townhouses", () => {
    const townhouse = comp("2/10 Park Terrace", "Townhouse", 650);

    expect(resolveRentalCompPropertyType(townhouse)).toBe("Townhouse");
  });

  it("fills a short townhouse pool with upper-band units only", () => {
    const townhouses = [
      comp("1 Exact Street", "Townhouse", 625),
      comp("2 Exact Street", "Townhouse", 650),
      comp("3 Exact Street", "Townhouse", 800, "North Adelaide"),
      comp("4 Exact Street", "Townhouse", 1_300, "Adelaide"),
    ];
    const lowerUnit = comp("1/8 Lower Street", "Apartment", 500);
    const middleUnit = comp("2/8 Middle Street", "Apartment", 620);
    const upperUnit = comp("3/8 Upper Street", "Apartment", 650);
    const premiumUnit = comp("4/8 Premium Street", "Unit", 725);
    const wrongType = comp("5 Wrong Street", "House", 700);

    const pool = buildRentalCompSelectionPool(
      [
        lowerUnit,
        middleUnit,
        upperUnit,
        premiumUnit,
        wrongType,
        ...townhouses,
      ],
      {
        suburb: "Gilberton",
        bedrooms: 2,
        bathrooms: 1,
        carSpaces: 1,
        subjectPropertyType: "Townhouse",
      },
    );

    expect(pool.slice(0, 4)).toEqual(townhouses);
    expect(pool).toContain(upperUnit);
    expect(pool).toContain(premiumUnit);
    expect(pool).not.toContain(lowerUnit);
    expect(pool).not.toContain(middleUnit);
    expect(pool).not.toContain(wrongType);
    expect(rentalCompSelectionTier(upperUnit, "Townhouse")).toBe(
      "upper_band_unit_fallback",
    );
  });

  it("does not mix units into the picker when six townhouses exist", () => {
    const townhouses = Array.from({ length: 6 }, (_, index) =>
      comp(`${index + 1} Exact Street`, "Townhouse", 625 + index * 10),
    );
    const unit = comp("1/8 Unit Street", "Unit", 900);

    const pool = buildRentalCompSelectionPool([...townhouses, unit], {
      suburb: "Gilberton",
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      subjectPropertyType: "Townhouse",
    });

    expect(pool).toEqual(townhouses);
  });

  it("never uses unit fallbacks for a house", () => {
    const house = comp("20 Joy Street", "House", 650, "Encounter Bay");
    const units = [
      comp("1/8 Unit Street", "Unit", 530, "Hayborough"),
      comp("2/8 Unit Street", "Unit", 500, "Hayborough"),
      comp("3/8 Unit Street", "Unit", 490, "Victor Harbor"),
    ];

    const pool = buildRentalCompSelectionPool([house, ...units], {
      suburb: "Encounter Bay",
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      subjectPropertyType: "House",
    });

    expect(pool).toEqual([house]);
    expect(units.every((unit) => !pool.includes(unit))).toBe(true);
  });
});
