import { afterEach, expect, it, vi } from "vitest";
import { lookupGoogleProperty, searchGoogleProperties } from "./propertyLookup";
import { geocodeAddress } from "./google";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("keeps a US unit and direction on address-only suggestions and uses the US market for manual review", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  const result = {
    formatted_address: "616 Croft Ave, West Hollywood, CA 90048, USA", place_id: "croft",
    address_components: [
      ["616", "street_number"], ["Croft Ave", "route"], ["West Hollywood", "locality"],
      ["CA", "administrative_area_level_1"], ["90048", "postal_code"], ["US", "country"],
    ].map(([name, type]) => ({ long_name: name, short_name: name, types: [type] })),
    geometry: { location: { lat: 34.08257, lng: -118.37391 } },
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "OK", results: [result] }) }));
  const [candidate] = await searchGoogleProperties("616 N Croft Ave apt 2, West Hollywood CA 90048", "US");
  expect(candidate).toMatchObject({ source: "google", country: "US", streetAddress: "616 N Croft Ave Apt 2" });
  expect(candidate.address).toContain("N Croft Ave Apt 2");
  const draft = await lookupGoogleProperty(candidate);
  expect(draft).toMatchObject({ country: "United States", property_address: candidate.streetAddress, state: "CA", postcode: "90048" });
  expect(draft.scraped_listing_json?.usProperty).toBeUndefined();
});
it("preserves a unit and street range on a partial Google match and does not certify its coordinates", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  const result = {
    formatted_address: "18/8 Ascot Street, Kensington NSW 2033",
    place_id: "partial",
    partial_match: true,
    address_components: [
      {
        long_name: "Kensington",
        short_name: "Kensington",
        types: ["locality"],
      },
      {
        long_name: "New South Wales",
        short_name: "NSW",
        types: ["administrative_area_level_1"],
      },
      { long_name: "2033", short_name: "2033", types: ["postal_code"] },
      { long_name: "Australia", short_name: "AU", types: ["country"] },
    ],
    geometry: { location: { lat: -33.9, lng: 151.2 } },
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ status: "OK", results: [result] }),
      }),
  );
  const [candidate] = await searchGoogleProperties(
    "18/8-12 Ascot Street, Kensington NSW 2033",
  );
  expect(candidate.streetAddress).toBe("18/8-12 Ascot Street");
  const draft = await lookupGoogleProperty(candidate);
  expect(draft.property_address).toBe("18/8-12 Ascot Street");
  expect(draft.latitude).toBeNull();
  expect(draft.scraped_listing_json?.warnings[0]).toContain("partial");
  await expect(geocodeAddress(candidate.address)).rejects.toThrow(
    "partially matched",
  );
});
