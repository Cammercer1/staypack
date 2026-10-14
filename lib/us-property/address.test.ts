import { expect, it } from "vitest";
import { matchesUsSearch, normaliseUsStreet, preserveUsStreet, usUnit } from "./address";
import { matchesUsAddress } from "./normalise";

const street = "616 N Croft Ave APT 2";
it.each([
  "616 North Croft Avenue Apt 2", "616 N. Croft Ave #2", "616 N Croft Ave Apt #2",
  "616 N Croft Ave, Apt 2", "616 N Croft Ave, #2, West Hollywood, CA 90048",
  "616 N Croft Ave Unit 2", "616 N Croft Ave Apt2",
])("matches apartment formatting without changing identity: %s", (input) => {
  expect(normaliseUsStreet(input)).toBe(normaliseUsStreet(street));
  expect(matchesUsAddress({ address: input, state: "CA", postcode: "90048-1234" }, { address: street, state: "CA", postcode: "90048" })).toBe(true);
});
it.each(["616 N Croft Ave", "616 N Croft Ave Apt 3", "616 S Croft Ave Apt 2", "618 N Croft Ave Apt 2"])("rejects a different home: %s", (input) => {
  expect(matchesUsSearch(input, street, "CA", "90048")).toBe(false);
  expect(matchesUsAddress({ address: input, state: "CA", postcode: "90048" }, { address: street, state: "CA", postcode: "90048" })).toBe(false);
});
it("preserves the screenshot address when Google drops its direction or unit", () => {
  expect(preserveUsStreet("616 N Croft Ave apt 2, West Hollywood CA 90048", "616 Croft Ave Apt 2")).toBe(street.replace("APT", "Apt"));
  expect(preserveUsStreet("616 North Croft Avenue, Apt 2, West Hollywood CA 90048", "616 Croft Ave")).toBe("616 N Croft Ave Apt 2");
  expect(preserveUsStreet(street, "616 Croft Ave Apt 3")).toBeNull();
  expect(preserveUsStreet(street, "618 Croft Ave")).toBeNull();
});
it("allows city formatting and a missing direction in search choices but keeps saved identity strict", () => {
  expect(matchesUsSearch("616 Croft Ave #2 West Hollywood CA 90048", street, "CA", "90048")).toBe(true);
  expect(matchesUsSearch("616 N Croft Ave Apt 2, Los Angeles, CA 90048", street, "CA", "90048")).toBe(true);
  expect(matchesUsSearch("616 N Croft Ave Apt 2, Los Angeles, CA 90049", street, "CA", "90048")).toBe(false);
  expect(matchesUsSearch("616 N Croft Ave Apt 2, Los Angeles, CA, 90049", street, "CA", "90048")).toBe(false);
  expect(matchesUsAddress({ address: "616 Croft Ave Apt 2", state: "CA", postcode: "90048" }, { address: street, state: "CA", postcode: "90048" })).toBe(false);
});
it("does not mistake street names for units or one penthouse number for another", () => {
  expect(usUnit("123 Stevens Rd")).toBeUndefined();
  expect(usUnit("123 Aptos Ave")).toBeUndefined();
  expect(normaliseUsStreet("616 N Croft Ave # Penthouse 8")).toBe(normaliseUsStreet("616 N Croft Ave Apt PH8"));
  expect(matchesUsSearch("616 N Croft Ave # Penthouse 9", "616 N Croft Ave # Penthouse 8", "CA", "90048")).toBe(false);
  expect(matchesUsSearch("616 N Croft Ave #8", "616 N Croft Ave # Penthouse 8", "CA", "90048")).toBe(false);
});
