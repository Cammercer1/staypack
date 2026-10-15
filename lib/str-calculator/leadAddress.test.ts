import { expect, it } from "vitest";
import { calculatorLeadAddress } from "./leadAddress";

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
