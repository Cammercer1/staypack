import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { identifyStrAmenity, importedStrAmenities, readStrPropertyContext, strPropertyContextSchema, suggestedWeeklyRent } from "./propertyInputs";

describe("STR property inputs", () => {
  it("imports explicit Domain amenities and rental estimate, without guessing from descriptions", () => {
    const { listing } = createLintRegressionFixtures();
    listing.scraped_listing_json = { ...listing.scraped_listing_json!, domainAvm: { urlSlug: "example", address: "Example", matchedAt: new Date().toISOString(), comparableSales: [], rentalEstimate: { weeklyRent: 950, confidence: "medium", date: "2026-10-10" } }, propertyLookup: { source: "domain", matchedAt: new Date().toISOString(), media: [], features: ["Swimming Pool", "air_conditioning", "Pool", "No pool", "Broadband internet available", "Internal laundry"] } };
    expect(importedStrAmenities(listing)).toEqual(["air_conditioning", "pool"]);
    expect(suggestedWeeklyRent(listing)).toMatchObject({ value: 950, source: "Estimated weekly rent" });
    expect(identifyStrAmenity("No pool")).toBeUndefined();
    expect(readStrPropertyContext(listing, { user_overrides_json: null })).toEqual({ propertyValue: null, weeklyRent: 950, amenities: ["air_conditioning", "pool"], additionalAmenities: [] });
  });
  it("preserves explicit clears instead of restoring imported defaults", () => {
    const { listing } = createLintRegressionFixtures();
    listing.advertised_weekly_rent = "$800 per week";
    const strProperty = { propertyValue: null, weeklyRent: null, amenities: [], additionalAmenities: [] };
    expect(suggestedWeeklyRent(listing)?.value).toBe(800);
    expect(readStrPropertyContext(listing, { user_overrides_json: { strProperty } })).toEqual(strProperty);
  });
  it("uses Domain valuation for older drafts, never the asking price, and respects a saved override", () => {
    const { listing } = createLintRegressionFixtures();
    listing.advertised_sale_price = "$1,600,000";
    listing.scraped_listing_json = { ...listing.scraped_listing_json!, domainAvm: { urlSlug: "example", address: "Example", matchedAt: new Date().toISOString(), comparableSales: [], valuation: { lowerPrice: 900000, midPrice: 1000000, upperPrice: 1100000, confidence: "medium" } } };
    const strProperty = { weeklyRent: 950, amenities: [], additionalAmenities: [] };
    expect(readStrPropertyContext(listing, { user_overrides_json: { strProperty } }).propertyValue).toBe(1000000);
    expect(readStrPropertyContext(listing, { user_overrides_json: { strProperty: { ...strProperty, propertyValue: 1200000 } } }).propertyValue).toBe(1200000);
    expect(readStrPropertyContext(listing, { user_overrides_json: { strProperty: { ...strProperty, propertyValue: null } } }).propertyValue).toBeNull();
    listing.scraped_listing_json!.domainAvm = undefined;
    expect(readStrPropertyContext(listing, { user_overrides_json: null }).propertyValue).toBeNull();
    for (const propertyValue of [0, -1, Infinity, 1000000001]) expect(strPropertyContextSchema.safeParse({ ...strProperty, propertyValue }).success).toBe(false);
  });
  it("validates figures and deduplicates custom features", () => {
    const context = { weeklyRent: 950, amenities: ["pool", "pool"], additionalAmenities: [" Tennis court ", "tennis court"] };
    expect(strPropertyContextSchema.parse(context)).toEqual({ weeklyRent: 950, amenities: ["pool"], additionalAmenities: ["Tennis court"] });
    for (const weeklyRent of [0, -1, Infinity, 50001]) expect(strPropertyContextSchema.safeParse({ ...context, weeklyRent }).success).toBe(false);
  });
});
