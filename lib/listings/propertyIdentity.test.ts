import { expect, it } from "vitest";
import { sameProperty } from "./propertyIdentity";
const ascot = {
  property_address: "18/8-12 Ascot Street",
  suburb: "Kensington",
  state: "NSW",
  postcode: "2033",
};
it.each([
  "Unit 18 / 8–12 Ascot St.",
  "18/8-12 Ascot Street, Kensington NSW 2033",
  "18/8-12 Ascot Street , Kensington NSW 2033",
  "18/8-12 Ascot Street Kensington NSW 2033 Australia",
])("recognizes the same unit: %s", (property_address) => {
  expect(
    sameProperty(ascot, {
      property_address,
      suburb: "Kensington",
      postcode: "2033",
    }),
  ).toBe(true);
});
it("matches provider whitespace before the locality separator in either direction", () => {
  const selected = {
    property_address: "24 South Esplanade",
    suburb: "Glenelg",
    state: "SA",
    postcode: "5045",
  };
  const returned = {
    property_address: "24 South Esplanade , Glenelg SA 5045",
  };
  expect(sameProperty(selected, returned)).toBe(true);
  expect(sameProperty(returned, selected)).toBe(true);
  expect(
    sameProperty(selected, {
      property_address: "25 South Esplanade , Glenelg SA 5045",
    }),
  ).toBe(false);
  expect(
    sameProperty(selected, {
      property_address: "1/24 South Esplanade , Glenelg SA 5045",
    }),
  ).toBe(false);
  expect(
    sameProperty(selected, {
      property_address: "24 South Esplanade , Glenelg SA 5046",
    }),
  ).toBe(false);
});
it.each([
  "6/8-12 Ascot Street",
  "18/8 Ascot Street",
  "8-12 Ascot Street",
  "18A/8-12 Ascot Street",
])("does not merge distinct addresses: %s", (property_address) => {
  expect(sameProperty(ascot, { ...ascot, property_address })).toBe(false);
});
it("requires compatible locality and preserves lettered street numbers", () => {
  expect(sameProperty(ascot, { ...ascot, postcode: "3031" })).toBe(false);
  expect(
    sameProperty(
      { property_address: "12/22A New Street", suburb: "Bondi" },
      { property_address: "12/22 New St", suburb: "Bondi" },
    ),
  ).toBe(false);
  expect(
    sameProperty(
      { property_address: "1 Main St" },
      { property_address: "1 Main Street" },
    ),
  ).toBe(false);
});
