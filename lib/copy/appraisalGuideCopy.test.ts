import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import { deriveLeaseAppraisalCopy } from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import { deriveSalesAppraisalCopy } from "@/lib/sales-appraisal/deriveSalesAppraisalCopy";
import { appraisalGuideCopy, rentalGuideComparison } from "./appraisalGuideCopy";

function fixture() {
  const { listing, agency } = createLintRegressionFixtures();
  listing.country = "AU";
  const parsed = resolveAppraisalInput(listing);
  parsed.domainAvm = { urlSlug: "2-6-tower-street-manly", address: "2/6 Tower Street, Manly", matchedAt: "2026-10-16T00:00:00Z", comparableSales: [],
    rentalEstimate: { weeklyRent: 565, confidence: "high" },
    valuation: { lowerPrice: 760000, midPrice: 880000, upperPrice: 1000000, confidence: "high" } };
  parsed.salesAppraisal = { priceMin: 835000, priceMax: 925000, priceMidpoint: 880000,
    agencyGuide: { displayPrice: "$795,000", priceMin: 795000, priceMax: 795000, priceMidpoint: 795000 } };
  return { listing, agency, parsed };
}

describe("appraisal guide copy", () => {
  it.each(["lease", "sales"] as const)("keeps a complete Tower Street sentence in the %s fallback instead of a clipped second sentence", kind => {
    const input = fixture();
    const first = "A lifestyle of elegance, luxury and convenience beckons in this immaculate Art Deco apartment that is nestled in a park-side cul-de-sac within moments to all Manly’s action.";
    input.parsed.description = `${first} Comfortably spacious, graced with character and refurbished with stylish contemporary finishes, it is hushed away from the hustle and bustle yet only a few minutes stroll from Manly’s beaches, the wharf and cosmopolitan eateries.`;
    const copy = kind === "lease"
      ? deriveLeaseAppraisalCopy({ ...input, compCount: 30, rentRangeLabel: "$540–$590", weeklyMin: 540, weeklyMax: 590 })
      : deriveSalesAppraisalCopy({ ...input, soldCompCount: 26, forSaleCompCount: 4, priceMin: 835000, priceMax: 925000 });
    expect(copy.blurb_variants?.short).toBe(first);
    expect(copy.blurb_variants?.medium?.split("\n\n")[0]).toBe(first);
    expect(copy.blurb_variants?.long?.split("\n\n")[0]).toBe(first);
    expect(copy.blurb).not.toContain("hu…");
  });

  it.each(["lease", "sales"] as const)("shortens an oversized first %s sentence only at a word boundary", kind => {
    const input = fixture();
    input.parsed.description = `${Array.from({ length: 60 }, () => "beautiful").join(" ")}.`;
    const copy = kind === "lease"
      ? deriveLeaseAppraisalCopy({ ...input, compCount: 30, rentRangeLabel: "$540–$590" })
      : deriveSalesAppraisalCopy({ ...input, soldCompCount: 26, forSaleCompCount: 4 });
    expect(copy.blurb_variants?.short?.length).toBeLessThanOrEqual(280);
    expect(copy.blurb_variants?.short).toMatch(/\bbeautiful…$/);
  });

  it("uses a neutral review instruction when suburb rental statistics are absent", () => {
    const input = fixture();
    delete input.parsed.ltrSuburbMarket;
    const copy = deriveLeaseAppraisalCopy({ ...input, compCount: 30, rentRangeLabel: "$540–$590", suburbMarket: null });
    expect(copy.appeal_points).toContain("Review local demand, condition and inclusions before setting the rent.");
    expect(JSON.stringify(copy)).not.toContain("Suburb rental fundamentals support");
  });

  it("attributes the saved sale estimate to automated evidence, not a different advertised guide", () => {
    const input = fixture();
    const before = structuredClone(input);
    const copy = deriveSalesAppraisalCopy({ ...input, soldCompCount: 26, forSaleCompCount: 4, priceMin: 835000, priceMax: 925000 });
    expect(copy.methodology_note).toContain("anchored to an automated property estimate");
    expect(copy.methodology_note).toContain("asking prices are separate context");
    expect(JSON.stringify(copy)).not.toMatch(/retains the agency|marketed guide is retained|\bREA\b|PropRadar|Domain|interquartile/);
    expect(input).toEqual(before);
  });

  it("does not describe an automated rent guide as comparable quartiles or a market premium", () => {
    const input = fixture();
    const copy = deriveLeaseAppraisalCopy({ ...input, compCount: 30, rentRangeLabel: "$540–$590", weeklyMin: 540, weeklyMax: 590, weeklyMid: 565 });
    expect(copy.methodology_note).toContain("weekly rental guide is anchored to an automated property estimate");
    expect(JSON.stringify(copy)).not.toMatch(/\bREA\b|PropRadar|Domain|interquartile|upper end|typical suburb|reasonable in the current market/);
  });

  it.each(["lease", "sales"] as const)("keeps the deterministic %s guide description once per longer variant", kind => {
    const input = fixture();
    const copy = kind === "lease"
      ? deriveLeaseAppraisalCopy({ ...input, compCount: 30, rentRangeLabel: "$540–$590", weeklyMin: 540, weeklyMax: 590 })
      : deriveSalesAppraisalCopy({ ...input, soldCompCount: 26, forSaleCompCount: 4, priceMin: 835000, priceMax: 925000 });
    const phrase = appraisalGuideCopy(kind, input.listing, input.parsed).description;
    expect(copy.blurb_variants?.short).not.toContain(phrase);
    for (const variant of [copy.blurb_variants?.medium, copy.blurb_variants?.long]) {
      expect(variant?.split(phrase)).toHaveLength(2);
    }
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("does not attribute a guide to an invalid automated amount: %s", amount => {
    const { listing, parsed } = fixture();
    // Legacy stored JSON may predate the provider's validated shape.
    Object.assign(parsed.domainAvm!.rentalEstimate!, { weeklyRent: amount });
    Object.assign(parsed.domainAvm!.valuation!, { midPrice: amount });
    expect(appraisalGuideCopy("lease", listing, parsed).basis).toBe("comparables");
    expect(appraisalGuideCopy("sales", listing, parsed).basis).toBe("comparables");
  });

  it.each(["lease", "sales"] as const)("prioritises explicit %s appraisal overrides over the automated estimate", kind => {
    const { listing, parsed } = fixture();
    listing.appraisal_overrides_json = kind === "lease" ? { lease: { weeklyMin: 700, weeklyMax: 750, weeklyMidpoint: 725 } } : { sales: { priceMin: 900000, priceMax: 950000, priceMidpoint: 925000 } };
    expect(appraisalGuideCopy(kind, listing, parsed)).toMatchObject({ basis: "override" });
    expect(appraisalGuideCopy(kind, listing, parsed).description).toContain("agent’s appraisal figures");
  });

  it("does not treat low-confidence advisory data or an empty override as the guide source", () => {
    const { listing, parsed } = fixture();
    parsed.domainAvm!.rentalEstimate!.confidence = "low";
    listing.appraisal_overrides_json = { lease: { weeklyMin: null, weeklyMax: null, weeklyMidpoint: null } };
    expect(appraisalGuideCopy("lease", listing, parsed)).toMatchObject({ basis: "comparables" });
  });
});

describe("selected rental evidence comparison", () => {
  it.each([
    [540, 590, [630, 650, 730, 750, 780, 850], "below"],
    [900, 950, [630, 850], "above"],
    [600, 700, [630, 850], null],
    [540, 630, [630, 850], null],
    [540, 590, [], null],
    [null, null, [630], null],
  ] as const)("compares a guide without inventing a new rent", (min, max, rents, expected) => {
    expect(rentalGuideComparison(min, max, rents)).toBe(expected);
  });
});
