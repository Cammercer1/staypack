import { expect, it } from "vitest";
import { sameProperty } from "@/lib/listings/propertyIdentity";
import { isProfileRangeAliasCandidate, selectProfileCandidate } from "./profileAddress";

const expected = { property_address: "14A/18-24 Aubrey Street", suburb: "Surfers Paradise", state: "QLD", postcode: "4217" };
const candidate = { source: "domain" as const, slug: "14a-18-aubrey-street-surfers-paradise-qld-4217", streetAddress: "14A/18 Aubrey St", address: "14A/18 Aubrey St, Surfers Paradise QLD 4217", suburb: expected.suburb, state: expected.state, postcode: expected.postcode };

it("finds an apartment range alias without weakening property deduplication", () => {
  const profile = { ...expected, property_address: candidate.streetAddress };
  expect(isProfileRangeAliasCandidate(expected, profile)).toBe(true);
  expect(isProfileRangeAliasCandidate(profile, expected)).toBe(true);
  expect(sameProperty(expected, profile)).toBe(false);
  expect(selectProfileCandidate([candidate], expected)).toMatchObject({ slug: candidate.slug, streetAddress: expected.property_address });
});

it.each([
  { property_address: "14B/18 Aubrey Street" },
  { property_address: "14/18 Aubrey Street" },
  { property_address: "18 Aubrey Street" },
  { property_address: "14A/18A Aubrey Street" },
  { property_address: "14A/20 Aubrey Street" },
  { property_address: "14A/18-22 Aubrey Street" },
  { property_address: "14A/18 Another Street" },
  { property_address: candidate.streetAddress, postcode: "4000" },
  { property_address: candidate.streetAddress, suburb: "Broadbeach" },
  { property_address: candidate.streetAddress, state: "NSW" },
])("rejects a different apartment, building or locality: %o", (address) => {
  expect(isProfileRangeAliasCandidate(expected, { ...expected, ...address })).toBe(false);
});

it("prefers exact matches and refuses ambiguous aliases", () => {
  const exact = { ...candidate, slug: "exact", streetAddress: expected.property_address };
  expect(selectProfileCandidate([candidate, exact], expected)).toBe(exact);
  expect(selectProfileCandidate([candidate, { ...candidate, slug: "another-profile" }], expected)).toBeUndefined();
});
