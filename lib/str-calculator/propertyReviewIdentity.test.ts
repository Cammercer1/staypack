import { expect, it } from "vitest";
import { airroiPropertyKey } from "@/lib/airroi/propertyIdentity";
import { calculatorPropertyReviewKey } from "./propertyReviewIdentity";

const au = { country: "Australia", property_address: "2/24 Cliffbrook Parade", suburb: "Clovelly", state: "NSW", postcode: "2031" };
const us = { country: "United States", property_address: "616 N Croft Avenue Apt 2", suburb: "West Hollywood", state: "CA", postcode: "90048" };

it.each([
  ["Unit 2, 24 Cliffbrook Parade", "Unit 2, 26 Cliffbrook Parade"],
  ["Unit 2, 24 Cliffbrook Parade", "Unit 2, 24 Different Street"],
  ["24 Cliffbrook Parade, Unit 2", "24 Cliffbrook Parade, Unit 3"],
  ["24 Cliffbrook Parade, Unit 2", "24 Cliffbrook Parade"],
  ["24 Cliffbrook Parade\nUnit 2", "24 Cliffbrook Parade\nUnit 3"],
  ["24 Cliffbrook Parade, Clovelly NSW 2031", "24 Cliffbrook Parade, Coogee NSW 2034"],
  ["24 Cliffbrook Parade Clovelly NSW 2031", "24 Cliffbrook Parade Clovelly VIC 2031"],
])("keeps distinct Australian property addresses separate: %s / %s", (first, second) => {
  expect(calculatorPropertyReviewKey({ ...au, property_address: first }))
    .not.toBe(calculatorPropertyReviewKey({ ...au, property_address: second }));
});

it("uses the complete ambiguous address with conservative whitespace and casing normalization", () => {
  const first = { ...au, property_address: "Unit 2, 24 Cliffbrook Parade" };
  expect(calculatorPropertyReviewKey({ ...first, property_address: " unit  2,  24 cliffbrook parade " }))
    .toBe(calculatorPropertyReviewKey(first));
  expect(JSON.parse(calculatorPropertyReviewKey(first))[1].fullAddress).toBe("unit 2, 24 cliffbrook parade");
});

it.each([
  "Unit 2 / 24 Cliffbrook Pde.",
  "2/24 Cliffbrook Parade, Clovelly NSW 2031",
  "2/24 Cliffbrook Parade, Clovelly, NSW 2031, Australia",
  "2/24 Cliffbrook Parade Clovelly NSW 2031 Australia",
])("retains equivalence for complete Australian addresses: %s", property_address => {
  expect(calculatorPropertyReviewKey({ ...au, property_address })).toBe(calculatorPropertyReviewKey(au));
});

it.each([
  "616 North Croft Ave. #2",
  "616 N Croft Ave, Apt 2",
  "616 N Croft Ave, Apt 2, West Hollywood, CA 90048, USA",
])("retains the complete US street and apartment identity: %s", property_address => {
  expect(calculatorPropertyReviewKey({ ...us, property_address })).toBe(calculatorPropertyReviewKey(us));
});

it.each([
  ["616 N Croft Ave, Floor 2", "616 N Croft Ave, Floor 3"],
  ["616 N Croft Ave, Apt 2, Floor 2", "616 N Croft Ave, Apt 2, Floor 3"],
  ["616 N Croft Ave\nApt 2", "616 N Croft Ave\nApt 3"],
])("retains unrecognized US comma and newline segments: %s / %s", (first, second) => {
  expect(calculatorPropertyReviewKey({ ...us, property_address: first }))
    .not.toBe(calculatorPropertyReviewKey({ ...us, property_address: second }));
});

it("keeps the address review independent of small coordinate differences", () => {
  expect(calculatorPropertyReviewKey({ ...au, latitude: -33.91, longitude: 151.26 }))
    .toBe(calculatorPropertyReviewKey({ ...au, latitude: -33.9101, longitude: 151.2601 }));
});

it.each(["Unit 2, 24 Cliffbrook Parade", "Unit 2, 26 Cliffbrook Parade", "24 Cliffbrook Parade, Unit 2"])(
  "confirms the tolerant AirROI cache already refuses ambiguous unit syntax: %s", property_address => {
    expect(airroiPropertyKey({ ...au, property_address })).toBeNull();
  },
);
