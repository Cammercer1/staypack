import { describe, expect, it } from "vitest";
import { deriveComparableEvidence } from "@/lib/lease-appraisal/comparableEvidenceCopy";

describe("deriveComparableEvidence", () => {
  it.each([[540, 590, "below"], [900, 950, "above"]] as const)("acknowledges a guide wholly outside the selected asking rents", (weeklyMin, weeklyMax, direction) => {
    const copy = deriveComparableEvidence({ suburb: "Manly", bedrooms: 1, bathrooms: 1, compCount: 30,
      weeklyMin, weeklyMax, featuredComps: [630, 650, 730, 750, 780, 850].map(weekly_rent => ({ weekly_rent })) });
    expect(copy).toContain(`The guide is ${direction} the selected advertised rents`);
    expect(copy).toContain("review the differences between the properties");
    expect(copy).not.toContain("reasonable in the current market");
  });

  it("keeps location factors generic and does not infer elevation from flooring", () => {
    const copy = deriveComparableEvidence({
      suburb: "Gilberton",
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      propertyType: "townhouse",
      description: "Polished timber floors and a single off-street carport.",
      compCount: 4,
      weeklyMin: 625,
      weeklyMax: 650,
      featuredComps: [{ weekly_rent: 625 }, { weekly_rent: 650 }],
    });

    expect(copy).toContain("local amenities and transport access");
    expect(copy).toContain("off-street parking");
    expect(copy).not.toContain("beach");
    expect(copy).not.toContain("elevated position");
  });

  it("describes unit fallbacks as secondary context for a townhouse", () => {
    const copy = deriveComparableEvidence({
      suburb: "Gilberton",
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      propertyType: "Townhouse",
      compCount: 4,
      weeklyMin: 625,
      weeklyMax: 650,
      featuredComps: [
        { weekly_rent: 625, property_type: "Townhouse" },
        { weekly_rent: 650, property_type: "Townhouse" },
        { weekly_rent: 700, property_type: "Apartment" },
      ],
    });

    expect(copy).toContain(
      "1 upper-band unit listing is shown as secondary context only",
    );
    expect(copy).toContain("between $625 and $650 per week");
    expect(copy).not.toContain("$700");
  });
});
