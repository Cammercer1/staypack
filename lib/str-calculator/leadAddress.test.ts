import { expect, it } from "vitest";
import { calculatorLeadAddress, canonicalCalculatorLeadAddress } from "./leadAddress";

it.each([
  ["1/24 Cliffbrook Parade, Clovelly NSW 2031", "AU", "1/24 Cliffbrook Parade", "Clovelly", "NSW", "2031"],
  ["14A/18-24 Aubrey Street, Surfers Paradise, QLD 4217, Australia", "AU", "14A/18-24 Aubrey Street", "Surfers Paradise", "QLD", "4217"],
  ["2 Smith Street, Darwin NT 0800", "AU", "2 Smith Street", "Darwin", "NT", "0800"],
  ["616 N Croft Ave Apt 2, West Hollywood CA 90048", "US", "616 N Croft Ave Apt 2", "West Hollywood", "CA", "90048"],
  ["616 N Croft Ave, Apt 2, West Hollywood, CA 90048, USA", "US", "616 N Croft Ave Apt 2", "West Hollywood", "CA", "90048"],
  ["12 W Main St, Boston MA 02108-1234, United States", "US", "12 W Main St", "Boston", "MA", "02108-1234"],
] as const)("retains street identity and locality for %s", (address, country, street, suburb, state, postcode) => {
  expect(calculatorLeadAddress(address, country)).toEqual({ property_address: street, suburb, state, postcode });
});

it.each([
  ["24 Beach Road", "AU"], ["24 Beach Road Bondi NSW 2026", "AU"],
  ["24 Beach Road, NSW 2026", "AU"], ["24 Beach Road, Bondi NSW", "AU"],
  ["Unit 2, 24 Beach Road, Bondi NSW 2026", "AU"],
  ["616 N Croft Ave, West Hollywood ZZ 90048", "US"],
  ["616 N Croft Ave, West Hollywood CA 90048, Canada", "US"],
  ["616 N Croft Ave,, West Hollywood CA 90048", "US"],
] as const)("keeps ambiguous address text intact without inventing locality: %s", (address, country) => {
  expect(calculatorLeadAddress(address, country)).toEqual({ property_address: address, suburb: null, state: null, postcode: null });
});

it.each([
  ["2/24 Cliffbrook Parade, Coogee NSW 2034", "AU", "Unit 2/24 Cliffbrook Parade, Clovelly NSW 2031, Australia"],
  ["14A/18-24 Aubrey St, Gold Coast QLD 4217", "AU", "Unit 14A/18-24 Aubrey Street, Surfers Paradise QLD 4217, Australia"],
  ["616 N Croft Ave, Apt 2, Los Angeles CA 90046", "US", "616 North Croft Avenue Apt 2, West Hollywood CA 90048, USA"],
] as const)("accepts a canonical locality only for the same complete property: %s", (address, country, canonical) => {
  expect(canonicalCalculatorLeadAddress(address, country, canonical)).toEqual(calculatorLeadAddress(canonical, country));
});

it.each([
  "1/24 Cliffbrook Parade, Clovelly NSW 2031, Australia",
  "24 Cliffbrook Parade, Clovelly NSW 2031, Australia",
  "Unit 2, 24 Cliffbrook Parade, Clovelly NSW 2031, Australia",
  "2/26 Cliffbrook Parade, Clovelly NSW 2031, Australia",
  "2/24A Cliffbrook Parade, Clovelly NSW 2031, Australia",
  "2/24-26 Cliffbrook Parade, Clovelly NSW 2031, Australia",
  "2/24 Cliffbrook Street, Clovelly NSW 2031, Australia",
  "2/24 Cliffbrook Parade, Clovelly VIC 2031, Australia",
  "2/24 Cliffbrook Parade, Clovelly NSW 2031, United States",
  "2/24 Cliffbrook Parade, Clovelly NSW",
  "2/24 Cliffbrook Parade Clovelly NSW 2031",
  "2/24 Cliffbrook Parade, Clovelly NSW 2031\nOther address",
  "", null, undefined, {},
])("rejects unsafe or incomplete canonical addresses: %j", canonical => {
  expect(canonicalCalculatorLeadAddress("2/24 Cliffbrook Parade, Coogee NSW 2034", "AU", canonical)).toBeNull();
});

it.each([
  "Cliffbrook Parade, Coogee NSW 2034",
  "2/24 Cliffbrook Parade, Coogee NSW",
  "Unit 2, 24 Cliffbrook Parade, Coogee NSW 2034",
  "Unit 24 Cliffbrook Parade, Coogee NSW 2034",
  "24 Cliffbrook Parade, Coogee NSW 2034",
])("does not infer a missing or ambiguous submitted unit from Google: %s", address => {
  expect(canonicalCalculatorLeadAddress(address, "AU", "Unit 2/24 Cliffbrook Parade, Clovelly NSW 2031, Australia")).toBeNull();
});

it.each([
  "616 N Croft Ave Apt 3, West Hollywood CA 90048, USA",
  "616 N Croft Ave, West Hollywood CA 90048, USA",
  "616 N Croft Ave Apt 2, West Hollywood NY 90048, USA",
])("preserves US apartment and state identity: %s", canonical => {
  expect(canonicalCalculatorLeadAddress("616 N Croft Ave Apt 2, Los Angeles CA 90046", "US", canonical)).toBeNull();
});
