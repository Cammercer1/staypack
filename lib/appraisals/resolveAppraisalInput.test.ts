import { describe, expect, it } from "vitest";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { appraisalInputError, appraisalInputFingerprint, hasStaleAppraisal, mergeAppraisalResults, resolveAppraisalInput } from "./resolveAppraisalInput";
import type { Listing, ParsedListing } from "@/lib/types";

const raw: ParsedListing = { address: "Old address", suburb: "Old suburb", state: "VIC", postcode: "3000", bedrooms: 2, images: ["https://example.com/imported.jpg"], agents: [], confidence: "medium", warnings: [], landAreaSqm: 500 };
function listing(overrides: Partial<Listing> = {}) {
  return createEmptyListingDraft({ property_address: "1 Test Street", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 3, bathrooms: 2, car_spaces: 0, property_type: "House", ...overrides });
}

describe("saved property appraisal input", () => {
  it("supports a manual listing with no import or URL", () => {
    const value = listing();
    expect(appraisalInputError(value)).toBeNull();
    expect(resolveAppraisalInput(value)).toMatchObject({ address: "1 Test Street", suburb: "Bondi", bedrooms: 3, carSpaces: 0, images: [], agents: [], warnings: [] });
    expect(value.scraped_listing_json).toBeNull();
  });
  it("uses saved corrections and uploads without changing the original import", () => {
    const value = listing({ scraped_listing_json: structuredClone(raw), uploaded_image_urls: ["https://example.com/upload.jpg"] });
    const before = structuredClone(value);
    expect(resolveAppraisalInput(value)).toMatchObject({ suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 3, landAreaSqm: 500, images: [...raw.images, "https://example.com/upload.jpg"] });
    expect(value).toEqual(before);
  });
  it.each(["suburb", "state", "postcode", "bedrooms"] as const)("does not resurrect a cleared %s from the import", (key) => {
    const value = listing({ scraped_listing_json: raw, [key]: null });
    expect(resolveAppraisalInput(value)[key]).toBeUndefined();
    expect(appraisalInputError(value)).toContain(key === "bedrooms" ? "bedroom count" : key);
  });
  it("normalises numeric database strings, whitespace and state casing", () => {
    const value = listing({ bedrooms: "3" as unknown as number, suburb: " Bondi ", state: " nsw " });
    expect(appraisalInputError(value)).toBeNull();
    expect(resolveAppraisalInput(value)).toMatchObject({ bedrooms: 3, suburb: "Bondi", state: "NSW" });
  });
  it.each([0, -1, 2.5, NaN, Infinity])("rejects an invalid bedroom count %s", (bedrooms) => {
    expect(appraisalInputError(listing({ bedrooms }))).toContain("bedroom count");
  });
  it("reports only the actual missing fields", () => {
    expect(appraisalInputError(listing({ postcode: "" }))).toBe("Add postcode in property details before fetching comparables.");
  });
  it("saves only generated fields and retains source facts and the other appraisal", () => {
    const value = listing({ scraped_listing_json: { ...raw, salesAppraisal: { priceMidpoint: 1_000_000 } } });
    const result = { ...resolveAppraisalInput(value), rentalAppraisal: { weeklyMidpoint: 900, compCount: 1 }, rentalComps: [{ address: "2 Test Street", weeklyRent: 900 }] };
    const stored = mergeAppraisalResults(value, "lease", result);
    expect(stored.suburb).toBe("Old suburb");
    expect(stored.bedrooms).toBe(2);
    expect(stored.salesAppraisal?.priceMidpoint).toBe(1_000_000);
    expect(stored.rentalAppraisal?.weeklyMidpoint).toBe(900);
    expect(stored.appraisalInputFingerprints?.lease).toBe(appraisalInputFingerprint(value));
    expect(hasStaleAppraisal({ ...value, scraped_listing_json: stored }, "lease")).toBe(false);
  });
  it("retains evidence for reloads and agent changes, but hides it after subject corrections", () => {
    const value = listing();
    value.scraped_listing_json = mergeAppraisalResults(value, "lease", { ...resolveAppraisalInput(value), rentalAppraisal: { weeklyMidpoint: 900, compCount: 1 } });
    expect(resolveAppraisalInput(structuredClone(value)).rentalAppraisal?.weeklyMidpoint).toBe(900);
    expect(hasStaleAppraisal({ ...value, agent_profile_id: "new-agent" }, "lease")).toBe(false);
    const changed = { ...value, bedrooms: 4 };
    expect(hasStaleAppraisal(changed, "lease")).toBe(true);
    expect(resolveAppraisalInput(changed).rentalAppraisal).toBeUndefined();
    expect(value.scraped_listing_json.rentalAppraisal).toBeDefined();
  });
  it("detects legacy evidence based on outdated imported details", () => {
    const value = listing({ scraped_listing_json: { ...raw, salesAppraisal: { compCount: 2, priceMidpoint: 900000 } } });
    expect(hasStaleAppraisal(value, "sales")).toBe(true);
    expect(resolveAppraisalInput(value).salesAppraisal).toBeUndefined();
  });

  it.each(["lease", "sales"] as const)("keeps fresh shared AVM evidence when only %s has been refreshed", (kind) => {
    const original = listing();
    const avm = { urlSlug: "1-test-street", address: "1 Test Street", bedrooms: 3, comparableSales: [], matchedAt: "2026-10-09T00:00:00Z" };
    original.scraped_listing_json = mergeAppraisalResults(original, "lease", {
      ...resolveAppraisalInput(original), domainAvm: avm,
      rentalAppraisal: { weeklyMidpoint: 900, compCount: 1 },
    });
    original.scraped_listing_json = mergeAppraisalResults(original, "sales", {
      ...resolveAppraisalInput(original), salesAppraisal: { priceMidpoint: 1_000_000, compCount: 1 },
    });

    const changed = { ...original, bedrooms: 4 };
    expect(resolveAppraisalInput(changed).domainAvm).toBeUndefined();
    const refreshedAvm = { ...avm, bedrooms: 4 };
    changed.scraped_listing_json = mergeAppraisalResults(changed, kind, {
      ...resolveAppraisalInput(changed), domainAvm: refreshedAvm,
      rentalAppraisal: { weeklyMidpoint: 1100, compCount: 1 },
      salesAppraisal: { priceMidpoint: 1_200_000, compCount: 1 },
    });

    expect(hasStaleAppraisal(changed, kind)).toBe(false);
    expect(hasStaleAppraisal(changed, kind === "lease" ? "sales" : "lease")).toBe(true);
    expect(resolveAppraisalInput(changed).domainAvm).toEqual(refreshedAvm);
    const saved = mergeAppraisalResults(changed, kind, resolveAppraisalInput(changed));
    expect(saved.domainAvm).toEqual(refreshedAvm);
    expect(saved.domainAvmInputFingerprint).toBe(appraisalInputFingerprint(changed));
    expect(resolveAppraisalInput({ ...changed, bedrooms: 5 }).domainAvm).toBeUndefined();
  });

  it("drops legacy AVM evidence after subject corrections even without an appraisal", () => {
    const value = listing();
    const avm = { urlSlug: "1-test-street", address: "1 Test Street", comparableSales: [], matchedAt: "2026-10-09T00:00:00Z" };
    value.scraped_listing_json = { ...resolveAppraisalInput(value), domainAvm: avm };
    expect(resolveAppraisalInput(value).domainAvm).toEqual(avm);
    expect(resolveAppraisalInput({ ...value, property_address: "2 Test Street" }).domainAvm).toBeUndefined();
    expect(value.scraped_listing_json.domainAvm).toEqual(avm);
  });

  it("clears the AVM marker when no AVM evidence is saved", () => {
    const value = listing();
    value.scraped_listing_json = {
      ...resolveAppraisalInput(value),
      domainAvm: { urlSlug: "1-test-street", address: "1 Test Street", comparableSales: [], matchedAt: "2026-10-09T00:00:00Z" },
      domainAvmInputFingerprint: appraisalInputFingerprint(value),
    };
    const saved = mergeAppraisalResults(value, "lease", { ...resolveAppraisalInput(value), domainAvm: undefined });
    expect(saved.domainAvm).toBeUndefined();
    expect(saved.domainAvmInputFingerprint).toBeUndefined();
  });
});
