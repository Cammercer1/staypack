import { describe, expect, it } from "vitest";
import { rapidApiReaListingToRecord } from "@/lib/rapidapi/normalizeRea";

describe("RapidAPI REA normalization", () => {
  it("normalizes a rich detail record into the existing REA contract", () => {
    const record = rapidApiReaListingToRecord({
      listing_id: "151654876",
      channel: "sold",
      url: "https://www.realestate.com.au/property-apartment-nsw-randwick-151654876",
      title: "Renovated apartment",
      description: "North-facing apartment with 92 sqm of internal space.",
      property_type: "apartment",
      construction_status: "established",
      price: "$1,250,000",
      price_raw: "$1.25m",
      sold_date: "2026-07-12",
      beds: 2,
      baths: 1,
      parking: 1,
      land_size: { value: 120, unit: "m²" },
      building_size: { value: 92, unit: "m²" },
      address: {
        street: "1/2 Example Street",
        suburb: "Randwick",
        postcode: "2031",
        state: "NSW",
      },
      main_image: "https://example.com/main.jpg",
      images: [
        "https://example.com/main.jpg",
        "https://example.com/second.jpg",
      ],
      advertisers: [
        {
          name: "Alex Agent",
          jobTitle: "Sales Agent",
          phone: "0400000000",
          email: "alex@example.com,office@example.com",
          photo: "https://example.com/alex.jpg",
        },
      ],
      is_sold: true,
      is_buy: false,
      is_rent: false,
    });

    expect(record).toMatchObject({
      source: "rapidapi_rea",
      listingId: "151654876",
      channel: "sold",
      status: "sold",
      price: "$1,250,000",
      address: "1/2 Example Street",
      suburb: "Randwick",
      postcode: "2031",
      state: "NSW",
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      landSize: { value: 120, unit: "m²" },
      floorArea: { value: 92, unit: "m²" },
      soldDate: "2026-07-12",
      images: [
        "https://example.com/main.jpg",
        "https://example.com/second.jpg",
      ],
      listing: {
        price: {
          display: "$1,250,000",
          value: 1_250_000,
        },
      },
    });
    expect(record.agents?.[0]).toMatchObject({
      name: "Alex Agent",
      emails: ["alex@example.com,office@example.com"],
    });
  });

  it("uses structured feature counts when top-level counts are absent", () => {
    const record = rapidApiReaListingToRecord({
      listing_id: 123,
      channel: "rent",
      price: "$900 per week",
      general_features: {
        bedrooms: { value: 2 },
        bathrooms: { value: 1 },
        parkingSpaces: { value: 1 },
      },
    });

    expect(record).toMatchObject({
      listingId: "123",
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      isRent: true,
      listing: {
        price: {
          value: 900,
          period: "week",
        },
      },
    });
  });
});
