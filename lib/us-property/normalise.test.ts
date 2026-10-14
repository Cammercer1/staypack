import { describe, expect, it } from "vitest";
import property from "./fixtures/west-hollywood.json";
import { normaliseUsProperty, matchesUsAddress } from "./normalise";
import { monthlyToWeekly, weeklyToMonthly } from "@/lib/property-market";
import { newListingPayload, valuesFromListing, newListingFormSchema } from "@/lib/listings/newListingDraft";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { parsedListingSchema } from "@/lib/validation/schemas";
import { avmPriceSuggestion } from "@/lib/listings/pricing";
import { resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";

describe("US property mapping (recorded West Hollywood response)", () => {
  it("keeps current estimates, historic sale and asking price distinct", () => {
    const { parsed } = normaliseUsProperty(property);
    expect(parsed.usProperty).toMatchObject({ currency: "USD", valuation: { mid: 1584100 }, rentMonthly: { mid: 6269 }, lastSold: { price: 780007 } });
    expect(parsed.displayPrice).toBeUndefined();
    expect(parsed.propertyLookup?.advertisedSalePrice).toBeNull();
    expect(parsed.floorAreaSqm).toBeCloseTo(104.05, 1);
    expect(parsedListingSchema.parse(parsed).usProperty?.raw.zestimate).toBe(1584100);
    const listing = createEmptyListingDraft({ country: "United States", property_address: parsed.address, suburb: parsed.suburb, state: parsed.state, postcode: parsed.postcode, bedrooms: parsed.bedrooms, bathrooms: parsed.bathrooms, property_type: parsed.propertyType, scraped_listing_json: parsed });
    expect(avmPriceSuggestion(listing, "sale")?.value).toBe(1584100);
    expect(weeklyToMonthly(avmPriceSuggestion(listing, "lease")!.value)).toBeCloseTo(6269);
    expect(resolveAppraisalInput(listing).salesAppraisal?.priceMidpoint).toBe(1584100);
  });
  it("does not substitute asking or historic sold prices for null estimates", () => {
    const { parsed } = normaliseUsProperty({ ...property, homeStatus: "FOR_SALE", price: 2000000, zestimate: null, rentZestimate: null });
    expect(parsed.usProperty?.valuation).toBeUndefined();
    expect(parsed.usProperty?.rentMonthly).toBeUndefined();
    expect(parsed.propertyLookup?.advertisedSalePrice).toContain("2,000,000");
  });
  it("requires matching street, unit, state and ZIP", () => {
    const { parsed } = normaliseUsProperty(property);
    expect(matchesUsAddress({ address: "545 Westbourne Drive", state: "CA", postcode: "90048" }, parsed)).toBe(true);
    for (const address of ["547 Westbourne Dr", "545 Westbourne Dr Unit 2", "545 Westbourne Blvd"]) expect(matchesUsAddress({ address, state: "CA", postcode: "90048" }, parsed)).toBe(false);
    expect(matchesUsAddress({ address: "545 Westbourne Dr", state: "FL", postcode: "90048" }, parsed)).toBe(false);
  });
  it("accepts US ZIPs and round-trips a monthly asking rent without multiplying by 52", () => {
    const draft = createEmptyListingDraft({ country: "United States", property_address: "545 Westbourne Dr", listing_purpose: "lease", advertised_weekly_rent: `$${monthlyToWeekly(6269)} per week` });
    const values = valuesFromListing(draft);
    expect(values.advertised_weekly_rent).toContain("6,269");
    expect(newListingFormSchema.safeParse({ ...values, postcode: "90048-1234" }).success).toBe(true);
    expect(newListingFormSchema.safeParse({ ...values, country: "AU", postcode: "90048" }).success).toBe(false);
    const saved = newListingPayload(draft, values, []);
    expect(saved.country).toBe("United States");
    expect(saved.advertised_weekly_rent).toBe(`$${monthlyToWeekly(6269)} per week`);
  });
});
