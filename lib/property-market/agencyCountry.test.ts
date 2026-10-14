import { describe, expect, it } from "vitest";
import { agencyCountry, assertRequestedCountry, assertPropertyCountry, assertListingUrlCountry } from "./agencyCountry";
describe("account country boundary", () => {
  it("defaults legacy accounts to Australia", () => expect(agencyCountry({})).toBe("AU"));
  it.each(["AU", "US"] as const)("allows only the account's %s country", country => {
    expect(assertRequestedCountry({ country_code: country })).toBe(country);
    expect(() => assertRequestedCountry({ country_code: country }, country === "AU" ? "US" : "AU")).toThrow("only");
    expect(() => assertRequestedCountry({ country_code: country }, "NZ")).toThrow("only");
  });
  it.each([
    ["AU", {country:"Australia", state:"NSW", postcode:"2033"}],
    ["US", {country:"United States", state:"CA", postcode:"90048"}],
    ["US", {country:"US", state:"NY", postcode:"10001-1234"}],
  ] as const)("accepts a valid %s property", (country, property) => expect(assertPropertyCountry({country_code:country},property)).toBe(country));
  it.each([
    ["AU", {country:"AU", state:"CA", postcode:"90048"}],
    ["US", {country:"US", state:"NSW", postcode:"2033"}],
    ["AU", {country:"New Zealand", state:"WA", postcode:"2033"}],
    ["US", {country:"US", state:"WA", postcode:"2033"}],
    ["AU", {country:"AU", state:"WA", postcode:"98101"}],
  ] as const)("rejects a mismatching %s property", (country, property) => expect(() => assertPropertyCountry({country_code:country},property)).toThrow());
  it("prevents links from changing the agency market", () => {
    expect(() => assertListingUrlCountry("AU","https://www.zillow.com/homedetails/123_zpid/")).toThrow("Australian");
    expect(() => assertListingUrlCountry("AU","https://www.trademe.co.nz/a/property/123")).toThrow("Australian");
    expect(() => assertListingUrlCountry("US","https://www.domain.com.au/example")).toThrow("US agency");
    expect(() => assertListingUrlCountry("US","https://www.zillow.com/homedetails/123_zpid/")).not.toThrow();
  });
});
