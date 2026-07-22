import { describe, expect, it } from "vitest";
import type { ApifyReaListingRecord } from "@/lib/apify/types";
import type { BrightDataReaRecord } from "@/lib/brightdata/types";
import { apifyReaRecordToSaleComp } from "@/lib/sales/parseApifyReaSaleListings";
import { reaRecordToSaleComp } from "@/lib/sales/parseReaSaleDiscover";
import { parseApifyReaRecord } from "@/lib/scraping/rea/parseApifyRea";
import { parseBrightDataReaRecord } from "@/lib/scraping/rea/parseBrightDataRea";

describe("REA listing and comparable property facts", () => {
  it("keeps Apify sold date and areas in listing and comparable parses", () => {
    const record: ApifyReaListingRecord = {
      channel: "sold",
      status: "sold",
      address: "13 Sussex Crescent",
      suburb: "Morphett Vale",
      state: "SA",
      postcode: "5162",
      propertyType: "House",
      price: "$849,000",
      soldDate: "2026-06-18",
      landSize: 970,
      floorArea: "184 m²",
      images: ["https://example.com/property.jpg"],
    };

    expect(parseApifyReaRecord(record)).toMatchObject({
      purpose: "sale",
      soldDate: "2026-06-18",
      landAreaSqm: 970,
      floorAreaSqm: 184,
    });
    expect(apifyReaRecordToSaleComp(record, "sold")).toMatchObject({
      saleStatus: "sold",
      soldDate: "2026-06-18",
      landAreaSqm: 970,
      floorAreaSqm: 184,
    });
  });

  it("keeps Bright Data sold date and areas in listing and comparable parses", () => {
    const record: BrightDataReaRecord = {
      listing_type: "sold",
      street_address: "8 Example Street",
      suburb: "Gilberton",
      state: "SA",
      postcode: "5081",
      property_type: "Townhouse",
      estimated_price: "$505,000",
      sold_date: "1 Jul 2026",
      land_area: { value: 420, unit: "m²" },
      floor_area: "155 sqm",
      images_urls: ["https://example.com/comparable.jpg"],
    };

    expect(parseBrightDataReaRecord(record)).toMatchObject({
      purpose: "sale",
      soldDate: "1 Jul 2026",
      landAreaSqm: 420,
      floorAreaSqm: 155,
    });
    expect(reaRecordToSaleComp(record, "sold")).toMatchObject({
      saleStatus: "sold",
      soldDate: "1 Jul 2026",
      landAreaSqm: 420,
      floorAreaSqm: 155,
    });
  });

  it("does not apply historical sold dates to current for-sale listings", () => {
    expect(
      parseApifyReaRecord({
        channel: "buy",
        status: "for sale",
        address: "1 Current Street",
        suburb: "Adelaide",
        dateSold: "2020-01-10",
      }).soldDate,
    ).toBeUndefined();

    expect(
      parseBrightDataReaRecord({
        listing_type: "buy",
        street_address: "1 Current Street",
        suburb: "Adelaide",
        sold_date: "2020-01-10",
      }).soldDate,
    ).toBeUndefined();
  });
});
