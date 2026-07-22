import type { BrightDataReaRecord } from "@/lib/brightdata/types";
import type { RentalComp } from "@/lib/rental/types";
import { normalizeReaImageUrl } from "@/lib/scraping/rea/normalizeReaImageUrl";

function parseCount(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function reaRecordToRentalComp(record: BrightDataReaRecord): RentalComp | null {
  const listingType = record.listing_type?.trim().toLowerCase();
  if (listingType && listingType !== "rent") {
    return null;
  }

  const weeklyRent = record.rent_price;
  if (weeklyRent == null || !Number.isFinite(Number(weeklyRent)) || Number(weeklyRent) <= 0) {
    return null;
  }

  const street = record.street_address?.trim();
  const suburb = record.suburb?.trim();
  if (!street && !suburb) {
    return null;
  }

  const address = street && suburb ? `${street}, ${suburb}` : street ?? suburb ?? "";
  const rawImage = record.images_urls?.find(
    (url) => typeof url === "string" && url.startsWith("http"),
  );

  return {
    address,
    suburb,
    weeklyRent: Number(weeklyRent),
    bedrooms: parseCount(record.bedrooms),
    bathrooms: parseCount(record.bathrooms),
    carSpaces: parseCount(record.parking),
    propertyType: record.property_type ?? record.house_type,
    imageUrl: rawImage ? normalizeReaImageUrl(rawImage) : undefined,
    listingUrl: record.url,
  };
}

export function parseReaRentDiscoverRecords(
  records: BrightDataReaRecord[],
): RentalComp[] {
  const comps: RentalComp[] = [];

  for (const record of records) {
    const comp = reaRecordToRentalComp(record);
    if (comp) {
      comps.push(comp);
    }
  }

  return comps;
}
