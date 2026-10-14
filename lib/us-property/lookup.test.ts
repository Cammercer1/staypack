import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./client", () => ({ fetchUsPropertyData: vi.fn() }));
import { fetchUsPropertyData } from "./client";
import { importUsProperty, lookupUsProperty, searchUsProperties } from "./lookup";
import property from "./fixtures/west-hollywood.json";

// Identity from the live response for the address in the user's screenshot.
const croft = { ...property, zpid: 333350724, address: { streetAddress: "616 N Croft Ave APT 2", city: "West Hollywood", state: "CA", zipcode: "90048" } };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(fetchUsPropertyData).mockResolvedValue(croft); });
it("uses the pasted address unchanged, then the selected property ID", async () => {
  const input = "616 N Croft Ave apt 2, West Hollywood CA 90048";
  const [candidate] = await searchUsProperties(input);
  expect(fetchUsPropertyData).toHaveBeenLastCalledWith("property-details-address", { address: input });
  expect(candidate).toMatchObject({ source: "zillow", country: "US", streetAddress: croft.address.streetAddress, zpid: "333350724" });
  const draft = await lookupUsProperty(candidate);
  expect(fetchUsPropertyData).toHaveBeenLastCalledWith("property-details", { zpid: "333350724" });
  expect(draft).toMatchObject({ property_address: croft.address.streetAddress, country: "United States", postcode: "90048" });
});
it("does not offer a building or another apartment for an apartment search", async () => {
  vi.mocked(fetchUsPropertyData).mockResolvedValue({ ...croft, address: { ...croft.address, streetAddress: "616 N Croft Ave" } });
  expect(await searchUsProperties("616 N Croft Ave Apt 2, West Hollywood CA 90048")).toEqual([]);
});
it("rechecks both the ID and address after selection", async () => {
  const [candidate] = await searchUsProperties("616 N Croft Ave Apt 2, West Hollywood CA 90048");
  vi.mocked(fetchUsPropertyData).mockResolvedValue({ ...croft, address: { ...croft.address, streetAddress: "616 N Croft Ave Apt 3" } });
  await expect(lookupUsProperty(candidate)).rejects.toThrow("does not match");
  vi.mocked(fetchUsPropertyData).mockResolvedValue({ ...croft, zpid: 1 });
  await expect(lookupUsProperty(candidate)).rejects.toThrow("selected home");
});
it("accepts a Zillow share link and explains building links without a property call", async () => {
  const draft = await importUsProperty("https://www.zillow.com/homedetails/616-N-Croft-Ave-APT-2-West-Hollywood-CA-90048/333350724_zpid/?utm_campaign=share");
  expect(draft.property_address).toBe(croft.address.streetAddress);
  vi.mocked(fetchUsPropertyData).mockClear();
  await expect(importUsProperty("https://www.zillow.com/b/example-building/")).rejects.toThrow("individual home or apartment");
  expect(fetchUsPropertyData).not.toHaveBeenCalled();
});
