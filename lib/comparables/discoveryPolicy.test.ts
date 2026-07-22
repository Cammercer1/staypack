import { describe, expect, it } from "vitest";
import {
  RENT_COMPARABLE_POOL_TARGETS,
  excludeSubjectComparables,
  isSubjectComparable,
  summarizeComparablePool,
} from "@/lib/comparables/discoveryPolicy";

describe("comparable discovery policy", () => {
  it("does not treat six dense-market matches as a healthy candidate pool", () => {
    const comparables = Array.from({ length: 6 }, (_, index) => ({
      suburb: "Randwick",
      address: `${index + 1} Example Street, Randwick`,
    }));

    expect(
      summarizeComparablePool({
        comparables,
        subjectSuburb: "Randwick",
        targets: RENT_COMPARABLE_POOL_TARGETS,
        attemptCount: 1,
        subjectExcludedCount: 0,
      }).targetMet,
    ).toBe(false);
  });

  it("stops broadening after reaching both total and local targets", () => {
    const comparables = [
      ...Array.from({ length: 8 }, (_, index) => ({
        suburb: "Randwick",
        address: `${index + 1} Local Street, Randwick`,
      })),
      ...Array.from({ length: 7 }, (_, index) => ({
        suburb: "Kingsford",
        address: `${index + 1} Nearby Street, Kingsford`,
      })),
    ];

    const summary = summarizeComparablePool({
      comparables,
      subjectSuburb: "Randwick",
      targets: RENT_COMPARABLE_POOL_TARGETS,
      attemptCount: 3,
      subjectExcludedCount: 0,
    });

    expect(summary.targetMet).toBe(true);
    expect(summary.poolCount).toBe(15);
    expect(summary.sameSuburbCount).toBe(8);
  });

  it("excludes the subject by canonical URL or normalized unit address", () => {
    const subject = {
      address: "1/32-38 Dutruc Street, Randwick",
      suburb: "Randwick",
      listingUrl:
        "https://www.realestate.com.au/property-apartment-nsw-randwick-150110324",
    };

    expect(
      isSubjectComparable(
        {
          address: "Different address",
          suburb: "Randwick",
          listingUrl:
            "https://www.realestate.com.au/property-apartment-nsw-randwick-150110324?source=refinement",
        },
        subject,
      ),
    ).toBe(true);
    expect(
      isSubjectComparable(
        {
          address: "1 / 32-38 Dutruc Street, Randwick",
          suburb: "Randwick",
        },
        subject,
      ),
    ).toBe(true);

    const result = excludeSubjectComparables(
      [
        {
          address: "1 / 32-38 Dutruc Street, Randwick",
          suburb: "Randwick",
        },
        {
          address: "3/10 Other Street, Randwick",
          suburb: "Randwick",
        },
      ],
      subject,
    );

    expect(result.excludedCount).toBe(1);
    expect(result.comparables).toHaveLength(1);
  });

  it("recognizes unit notation and a full suburb/state/postcode suffix", () => {
    const result = excludeSubjectComparables(
      [
        {
          address: "Unit 1, 32-38 Dutruc St, Randwick NSW 2031",
          suburb: "Randwick",
        },
      ],
      {
        address: "1/32-38 Dutruc Street",
        suburb: "Randwick",
      },
    );

    expect(result.excludedCount).toBe(1);
    expect(result.comparables).toEqual([]);
  });
});
