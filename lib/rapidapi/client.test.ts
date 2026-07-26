import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRapidApiReaSearchRequestUrl,
  getRapidApiReaMaxListings,
  scrapeRapidApiReaListingUrl,
  scrapeRapidApiReaSearchUrls,
} from "@/lib/rapidapi/client";

describe("RapidAPI REA client", () => {
  beforeEach(() => {
    vi.stubEnv("RAPIDAPI_REA_KEY", "test-key");
    vi.stubEnv("RAPIDAPI_REA_HOST", "realestate-com-au4.p.rapidapi.com");
    vi.stubEnv("REA_COMPARABLE_CACHE_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requests up to 100 comparable listings by default", () => {
    vi.stubEnv("RAPIDAPI_REA_MAX_LISTINGS", "");
    expect(getRapidApiReaMaxListings()).toBe(100);
  });

  it("translates the existing REA search URL filters into byurl parameters", () => {
    const requestUrl = buildRapidApiReaSearchRequestUrl(
      "https://www.realestate.com.au/sold/property-unit+apartment-with-2-bedrooms-between-500000-and-1500000-in-randwick,+nsw+2031/list-2?numBaths=1&numParkingSpaces=1&activeSort=solddate&keywords=pool%2Cgarage",
      {
        resultCount: 30,
        includeSurroundingSuburbs: false,
      },
    );

    expect(requestUrl.pathname).toBe("/search/byurl");
    expect(Object.fromEntries(requestUrl.searchParams)).toMatchObject({
      page: "2",
      resultCount: "30",
      sortOrder: "Most_Recently_Sold",
      searchType: "Sold",
      propertyType: "Unit,Apartment",
      priceRange: "min:500000,max:1500000",
      bedsRange: "min:2,max:2",
      bathsRange: "min:1",
      carSpacesRange: "min:1",
      surroundingSuburbs: "false",
      keywords: "pool,garage",
    });
  });

  it("normalizes search results and sends credentials only as headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Success",
          searchResults: [
            {
              listing_id: "444690016",
              channel: "rent",
              price: "$900 per week",
              beds: 2,
              baths: 1,
              address: {
                street: "3/225 Avoca Street",
                suburb: "Randwick",
                postcode: "2031",
                state: "NSW",
              },
              url: "https://www.realestate.com.au/property-apartment-nsw-randwick-444690016",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const records = await scrapeRapidApiReaSearchUrls({
      searchUrls: [
        "https://www.realestate.com.au/rent/with-2-bedrooms-in-randwick,+nsw+2031/list-1?maxBeds=2&activeSort=list-date",
      ],
      maxItems: 30,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      source: "rapidapi_rea",
      listingId: "444690016",
      channel: "rent",
      bedrooms: 2,
      price: "$900 per week",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("test-key");
    expect((init as RequestInit).headers).toMatchObject({
      "X-RapidAPI-Key": "test-key",
      "X-RapidAPI-Host": "realestate-com-au4.p.rapidapi.com",
    });
  });

  it("uses the property detail endpoint for initial listing import", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Success",
          detail: {
            listing_id: "151654876",
            channel: "buy",
            title: "Apartment title",
            description: "Full property description",
            property_type: "apartment",
            address: {
              street: "1/2 Example Street",
              suburb: "Randwick",
              postcode: "2031",
              state: "NSW",
            },
            images: ["https://example.com/property.jpg"],
            advertisers: [{ name: "Alex Agent" }],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const record = await scrapeRapidApiReaListingUrl(
      "https://www.realestate.com.au/property-apartment-nsw-randwick-151654876",
    );

    expect(record).toMatchObject({
      listingId: "151654876",
      address: "1/2 Example Street",
      suburb: "Randwick",
      description: "Full property description",
    });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/details/byurl?");
  });
});
