import { afterEach, expect, it, vi } from "vitest";
import { geocodeAddress } from "./google";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function response(types: string[], partial_match = false) {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "OK", results: [{ formatted_address: "12 Test Street, Sydney NSW 2000", place_id: "real", types, partial_match, geometry: { location: { lat: -33.8, lng: 151.2 } } }] }) }));
}
it("requires a property address for the public calculator instead of estimating a suburb centroid", async () => {
  response(["locality", "political"]);
  await expect(geocodeAddress("Sydney NSW 2000", "AU", { requireStreetAddress: true })).rejects.toThrow("full street address");
  // Existing callers retain their previous address lookup behaviour.
  expect((await geocodeAddress("Sydney NSW 2000")).placeId).toBe("real");
});
it("accepts street and unit matches while rejecting partial matches", async () => {
  for (const type of ["street_address", "premise", "subpremise"]) {
    response([type]);
    expect((await geocodeAddress("12 Test Street, Sydney NSW 2000", "AU", { requireStreetAddress: true })).latitude).toBe(-33.8);
  }
  response(["street_address"], true);
  await expect(geocodeAddress("12 Test Street, Sydney NSW 2000", "AU", { requireStreetAddress: true })).rejects.toThrow("partially matched");
});
