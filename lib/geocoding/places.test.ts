import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { autocompleteAddresses, completePlaceAddress } from "./places";
const request = vi.fn();
const session = "04a22f81-999e-4c8d-b164-51b706029580";
beforeEach(() => { vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-secret"); vi.stubGlobal("fetch", request); request.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("uses Australian Places suggestions, limits fields, and ranks the exact unit/street numbers first", async () => {
  request.mockResolvedValue({ ok: true, json: async () => ({ suggestions: ["22a/12", "12/22a"].map((number) => ({ placePrediction: { placeId: number, text: { text: `${number} New Street, Bondi NSW` }, structuredFormat: { mainText: { text: `${number} New Street` }, secondaryText: { text: "Bondi NSW" } } } })) }) });
  const result = await autocompleteAddresses("12/22A New Street Bon", session);
  expect(result[0].mainText).toBe("12/22a New Street");
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ includedRegionCodes: ["au"], sessionToken: session });
  expect(request.mock.calls[0][1].headers["X-Goog-Api-Key"]).toBe("server-secret");
  expect(JSON.stringify(result)).not.toContain("server-secret");
});
it("completes the postcode without losing the selected unit or street range", async () => {
  request.mockResolvedValue({ ok: true, json: async () => ({ formattedAddress: "8 Ascot St, Kensington NSW 2033", addressComponents: [
    { longText: "Australia", shortText: "AU", types: ["country"] },
    { longText: "Kensington", types: ["locality"] },
    { shortText: "NSW", types: ["administrative_area_level_1"] },
    { longText: "2033", types: ["postal_code"] },
  ] }) });
  expect(await completePlaceAddress("building", session, "18/8-12 Ascot Street, Kensington NSW")).toBe("18/8-12 Ascot Street, Kensington NSW 2033");
  expect(request.mock.calls[0][0]).toContain(`sessionToken=${session}`);
});
it("fails cleanly without a key or when Google rejects the request", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
  await expect(autocompleteAddresses("Ascot", session)).rejects.toThrow("still type");
  expect(request).not.toHaveBeenCalled();
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-secret");
  request.mockResolvedValue({ ok: false });
  await expect(autocompleteAddresses("Ascot", session)).rejects.toThrow("still type");
});
