import type { ApifyReaListingRecord } from "@/lib/apify/types";
import type { RentalComp } from "@/lib/rental/types";
import { normalizeReaImageUrl } from "@/lib/scraping/rea/normalizeReaImageUrl";

function parseWeeklyRentFromDisplay(price?: string | null) {
  if (!price?.trim()) {
    return null;
  }

  const normalized = price.trim().toLowerCase();
  if (!normalized.includes("week") && !normalized.includes("/wk")) {
    return null;
  }

  const match = price.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!match?.[1]) {
    return null;
  }

  const value = Number.parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveWeeklyRent(record: ApifyReaListingRecord) {
  const structured = record.listing?.price;
  if (
    structured?.value != null &&
    Number.isFinite(structured.value) &&
    structured.value > 0
  ) {
    const period = structured.period?.trim().toLowerCase();
    if (!period || period.includes("week")) {
      return structured.value;
    }
  }

  return parseWeeklyRentFromDisplay(record.price);
}

export function apifyReaRecordToRentalComp(
  record: ApifyReaListingRecord,
): RentalComp | null {
  const channel = record.channel?.trim().toLowerCase();
  if (channel && channel !== "rent") {
    return null;
  }

  const weeklyRent = resolveWeeklyRent(record);
  if (weeklyRent == null) {
    return null;
  }

  const street = record.address?.trim();
  const suburb = record.suburb?.trim();
  if (!street && !suburb) {
    return null;
  }

  const address = street && suburb ? `${street}, ${suburb}` : street ?? suburb ?? "";
  const rawImage = record.images?.find(
    (url) => typeof url === "string" && url.startsWith("http"),
  );

  return {
    address,
    suburb,
    weeklyRent,
    bedrooms: record.bedrooms ?? undefined,
    bathrooms: record.bathrooms ?? undefined,
    propertyType: record.propertyType ?? undefined,
    imageUrl: rawImage ? normalizeReaImageUrl(rawImage) : undefined,
    listingUrl: record.url,
  };
}

export function parseApifyReaListings(records: ApifyReaListingRecord[]): RentalComp[] {
  const comps: RentalComp[] = [];

  for (const record of records) {
    const comp = apifyReaRecordToRentalComp(record);
    if (comp) {
      comps.push(comp);
    }
  }

  return comps;
}
