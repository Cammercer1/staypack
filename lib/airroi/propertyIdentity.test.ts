import { expect, it } from "vitest";
import { airroiPropertyKey } from "./propertyIdentity";

const au = { country: "AU", property_address: "18/8-12 Ascot Street", suburb: "Kensington", state: "NSW", postcode: "2033" };
const us = { country: "US", property_address: "616 N Croft Avenue Apt 2", suburb: "West Hollywood", state: "CA", postcode: "90048" };

it.each([
  "Unit 18 / 8–12 Ascot St.",
  "18/8-12 Ascot Street, Kensington NSW 2033",
  "18/8-12 Ascot Street, Kensington, NSW 2033, Australia",
  "18/8-12 Ascot Street Kensington NSW 2033 Australia",
])("recognizes the same complete Australian property: %s", property_address => {
  expect(airroiPropertyKey({ ...au, property_address, country: "Australia", suburb: " kensington ", state: "nsw" })).toBe(airroiPropertyKey(au));
  expect(airroiPropertyKey(au)).toMatch(/^[a-f0-9]{64}$/);
});

it.each([
  "616 North Croft Ave. #2",
  "616 N Croft Ave, Apt 2",
  "616 N Croft Ave, Apt 2, West Hollywood, CA 90048, USA",
  "616 N Croft Ave Unit 2, West Hollywood CA 90048",
])("recognizes the same complete US apartment: %s", property_address => {
  expect(airroiPropertyKey({ ...us, property_address, country: "United States", suburb: "west hollywood" })).toBe(airroiPropertyKey(us));
  expect(airroiPropertyKey(us)).toMatch(/^[a-f0-9]{64}$/);
});

it("matches US ZIP+4 without dropping the apartment identity", () => {
  expect(airroiPropertyKey({ ...us, postcode: "90048-1234" })).toBe(airroiPropertyKey(us));
});

it.each(["6/8-12 Ascot Street", "18A/8-12 Ascot Street", "18/8 Ascot Street", "8-12 Ascot Street", "18/8-12A Ascot Street"])("separates Australian units, houses and ranges: %s", property_address => {
  const key = airroiPropertyKey({ ...au, property_address });
  expect(key).not.toBeNull();
  expect(key).not.toBe(airroiPropertyKey(au));
});

it.each(["616 S Croft Ave Apt 2", "616 Croft Ave Apt 2", "616 N Croft Ave Apt 3", "616 N Croft Ave", "618 N Croft Ave Apt 2"])("separates US direction, apartment and house numbers: %s", property_address => {
  const key = airroiPropertyKey({ ...us, property_address });
  expect(key).not.toBeNull();
  expect(key).not.toBe(airroiPropertyKey(us));
});

it.each(["property_address", "suburb", "state", "postcode", "country"] as const)("requires an explicit complete %s", field => {
  expect(airroiPropertyKey({ ...au, [field]: null })).toBeNull();
  expect(airroiPropertyKey({ ...au, [field]: " " })).toBeNull();
});

it.each([
  { country: "New Zealand" }, { state: "ZZ" }, { postcode: "203" },
  { property_address: "Ascot Street" }, { property_address: "Unit 18, 8-12 Ascot Street" },
  { property_address: "8-12 Ascot Street, Unit 18" }, { property_address: "Unit 18 Ascot Street" },
  { property_address: "18/8-12 Ascot Street, Randwick NSW 2033" },
  { property_address: "18/8-12 Ascot Street, Kensington NSW 2034" },
  { property_address: "18/8-12 Ascot Street Kensington NSW 2034 Australia" },
  { property_address: "18/8-12 Ascot Street Kensington VIC 2033" },
  { property_address: "18/8-12 Ascot Street,, Kensington NSW 2033" },
  { property_address: "18/8-12 Ascot Street\nUnit 4" },
])("refuses ambiguous or inconsistent Australian identity: %j", patch => {
  expect(airroiPropertyKey({ ...au, ...patch })).toBeNull();
});

it.each([
  { country: "Canada" }, { state: "ZZ" }, { postcode: "9004" },
  { property_address: "616 N Croft Ave, Floor 2" },
  { property_address: "616 N Croft Ave, Apt 2, Los Angeles, CA 90048" },
  { property_address: "616 N Croft Ave, Apt 2, West Hollywood CA 90048, Canada" },
])("refuses ambiguous or inconsistent US identity: %j", patch => {
  expect(airroiPropertyKey({ ...us, ...patch })).toBeNull();
});

it("separates locality and postal differences even for identical street lines", () => {
  expect(airroiPropertyKey({ ...au, suburb: "Other Kensington" })).not.toBe(airroiPropertyKey(au));
  expect(airroiPropertyKey({ ...au, postcode: "2034" })).not.toBe(airroiPropertyKey(au));
  expect(airroiPropertyKey({ ...us, state: "NY" })).not.toBe(airroiPropertyKey(us));
});
