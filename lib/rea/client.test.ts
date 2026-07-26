import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rapidSearch: vi.fn(),
  rapidDetails: vi.fn(),
  apifySearch: vi.fn(),
  apifyDetails: vi.fn(),
}));

vi.mock("@/lib/rapidapi/client", () => ({
  getRapidApiReaMaxListings: () => 50,
  hasRapidApiReaConfig: () => Boolean(process.env.RAPIDAPI_REA_KEY),
  scrapeRapidApiReaSearchUrls: mocks.rapidSearch,
  scrapeRapidApiReaListingUrls: mocks.rapidDetails,
}));

vi.mock("@/lib/apify/client", () => ({
  getApifyReaMaxListings: () => 50,
  hasApifyReaConfig: () => Boolean(process.env.APIFY_API_KEY),
  scrapeApifyReaRentSearchUrls: mocks.apifySearch,
  scrapeApifyReaListingUrls: mocks.apifyDetails,
}));

import {
  getReaProviderOrder,
  scrapeReaListingUrl,
  scrapeReaSearchUrls,
} from "@/lib/rea/client";

describe("REA provider client", () => {
  beforeEach(() => {
    vi.stubEnv("RAPIDAPI_REA_KEY", "rapid-key");
    vi.stubEnv("APIFY_API_KEY", "apify-key");
    vi.stubEnv("REA_PRIMARY_PROVIDER", "rapidapi");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses RapidAPI first when both providers are configured", async () => {
    mocks.rapidDetails.mockResolvedValue([{ listingId: "rapid-1" }]);

    const result = await scrapeReaListingUrl("https://example.com/listing");

    expect(result).toEqual({
      record: { listingId: "rapid-1" },
      provider: "rapidapi",
    });
    expect(mocks.apifyDetails).not.toHaveBeenCalled();
  });

  it("falls back to Apify when a RapidAPI search fails", async () => {
    mocks.rapidSearch.mockRejectedValue(new Error("RapidAPI unavailable"));
    mocks.apifySearch.mockResolvedValue([{ listingId: "apify-1" }]);

    const result = await scrapeReaSearchUrls({
      searchUrls: ["https://example.com/search"],
      maxItems: 30,
    });

    expect(result).toEqual({
      records: [{ listingId: "apify-1" }],
      provider: "apify",
    });
    expect(mocks.apifySearch).toHaveBeenCalledOnce();
  });

  it("supports an emergency Apify-first override", () => {
    vi.stubEnv("REA_PRIMARY_PROVIDER", "apify");
    expect(getReaProviderOrder()).toEqual(["apify", "rapidapi"]);
  });
});
