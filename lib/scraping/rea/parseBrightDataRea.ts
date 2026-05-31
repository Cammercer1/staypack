import type { BrightDataReaRecord } from "@/lib/brightdata/types";
import type { ParsedListing } from "@/lib/types";

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

function detectPurpose(record: BrightDataReaRecord): ParsedListing["purpose"] {
  const listingType = record.listing_type?.trim().toLowerCase();
  if (listingType === "rent" || listingType === "lease") {
    return "lease";
  }
  if (listingType === "buy" || listingType === "sale") {
    return "sale";
  }
  if (record.rent_price != null) {
    return "lease";
  }
  return undefined;
}

function buildDisplayPrice(record: BrightDataReaRecord) {
  if (record.estimated_price?.trim()) {
    return record.estimated_price.trim();
  }
  if (record.rent_price != null) {
    const currency = record.rent_currency?.trim() || "AUD";
    const suffix = currency === "AUD" ? " per week" : "";
    return `$${record.rent_price.toLocaleString("en-AU")}${suffix}`;
  }
  return undefined;
}

function buildAddress(record: BrightDataReaRecord) {
  const street = record.street_address?.trim();
  const suburb = record.suburb?.trim();
  if (street && suburb) {
    return `${street}, ${suburb}`;
  }
  if (street) {
    return street;
  }

  const fullSuburb = record.fullSuburb?.trim();
  if (fullSuburb) {
    return fullSuburb.split(",")[0]?.trim() || fullSuburb;
  }

  return undefined;
}

function buildTitle(record: BrightDataReaRecord, address?: string) {
  const propertyType = record.property_type ?? record.house_type;
  const bedrooms = parseCount(record.bedrooms);
  const parts = [
    propertyType,
    bedrooms != null ? `${bedrooms} bed` : null,
    address,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : address;
}

export function parseBrightDataReaRecord(
  record: BrightDataReaRecord,
): ParsedListing {
  const address = buildAddress(record);
  const images = (record.images_urls ?? []).filter(
    (url) => typeof url === "string" && url.startsWith("http"),
  );
  const agents = (record.agents ?? [])
    .filter((agent) => agent.name?.trim())
    .map((agent) => ({
      name: agent.name?.trim(),
      phone: agent.phone?.trim() || undefined,
    }));

  const listing: ParsedListing = {
    title: buildTitle(record, address),
    address,
    suburb: record.suburb?.trim(),
    state: record.state?.trim()?.toUpperCase(),
    postcode: record.postcode?.trim(),
    propertyType: record.property_type ?? record.house_type,
    purpose: detectPurpose(record),
    bedrooms: parseCount(record.bedrooms),
    bathrooms: parseCount(record.bathrooms),
    carSpaces: record.parking ?? undefined,
    description: record.description?.trim(),
    displayPrice: buildDisplayPrice(record),
    images,
    agents,
    confidence:
      address && images.length && record.description?.trim()
        ? "high"
        : address
          ? "medium"
          : "low",
    warnings: [],
  };

  if (!address) {
    listing.warnings.push("Bright Data REA record did not include a street address.");
  }

  return listing;
}
