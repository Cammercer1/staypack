import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrichListingWithDomainAvm,
  fetchDomainAvmForListing,
} from "@/lib/domain-avm/client";
import type { ParsedListing } from "@/lib/types";

const listing: ParsedListing = {
  address: "4/12-14 Belmore Road",
  suburb: "Randwick",
  state: "NSW",
  postcode: "2031",
  propertyType: "Apartment",
  bedrooms: 2,
  bathrooms: 2,
  carSpaces: 0,
  images: [],
  agents: [],
  confidence: "high",
  warnings: [],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Domain AVM client", () => {
  beforeEach(() => {
    vi.stubEnv("RAPIDAPI_REA_KEY", "test-key");
    vi.stubEnv("RAPIDAPI_DOMAIN_HOST", "domain-au.p.rapidapi.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires an exact autocomplete and detail address match", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              urlSlug: "4-12-14-belmore-road-randwick-nsw-2031",
              address: "4/12-14 Belmore Road, Randwick NSW 2031",
              suburb: "Randwick",
              state: "NSW",
              postcode: "2031",
              relativeScore: 100,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            propertyDetails: {
              propertyId: "JP-9750-EJ",
              address: {
                displayAddress: "4/12-14 Belmore Road, Randwick NSW 2031",
                suburbName: "Randwick",
                state: "NSW",
                postcode: "2031",
              },
              type: "Apartment",
              bedrooms: 2,
              bathrooms: 2,
              parkingSpaces: 0,
              'internalArea({"unit":"SQUARE_METERS"})': 85,
              valuation: {
                lowerPrice: 800_000,
                midPrice: 930_000,
                upperPrice: 1_060_000,
                priceConfidence: "High",
                source: "APM",
              },
              rentalEstimate: {
                weeklyRentEstimate: 885,
                rentalFsdConfidence: "High",
              },
              comparableSales: [],
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDomainAvmForListing(listing);

    expect(result).toMatchObject({
      address: "4/12-14 Belmore Road, Randwick NSW 2031",
      propertyType: "Apartment",
      floorAreaSqm: 85,
      valuation: {
        midPrice: 930_000,
        confidence: "high",
      },
      rentalEstimate: {
        weeklyRent: 885,
        confidence: "high",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/estimates/auto-complete?",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/estimates/details?");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "X-RapidAPI-Key": "test-key",
      "X-RapidAPI-Host": "domain-au.p.rapidapi.com",
    });
  });

  it("rejects a different unit before requesting details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            urlSlug: "5-12-14-belmore-road-randwick-nsw-2031",
            address: "5/12-14 Belmore Road, Randwick NSW 2031",
            suburb: "Randwick",
            state: "NSW",
            postcode: "2031",
            relativeScore: 100,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDomainAvmForListing(listing)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses fresh persisted data without spending Domain API calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cached = {
      urlSlug: "4-12-14-belmore-road-randwick-nsw-2031",
      address: "4/12-14 Belmore Road, Randwick NSW 2031",
      comparableSales: [],
      matchedAt: new Date().toISOString(),
    };

    const result = await enrichListingWithDomainAvm({
      ...listing,
      domainAvm: cached,
    });

    expect(result.status).toBe("cached");
    expect(result.listing.domainAvm).toBe(cached);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes persisted AVM evidence when the kill switch is off", async () => {
    vi.stubEnv("RAPIDAPI_DOMAIN_AVM_ENABLED", "false");

    const result = await enrichListingWithDomainAvm({
      ...listing,
      domainAvm: {
        urlSlug: "4-12-14-belmore-road-randwick-nsw-2031",
        address: "4/12-14 Belmore Road, Randwick NSW 2031",
        comparableSales: [],
        matchedAt: new Date().toISOString(),
      },
    });

    expect(result.status).toBe("disabled");
    expect(result.listing.domainAvm).toBeUndefined();
  });
});
