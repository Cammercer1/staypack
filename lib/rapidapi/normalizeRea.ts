import type { ApifyReaListingRecord } from "@/lib/apify/types";
import type {
  RapidApiReaAdvertiser,
  RapidApiReaFeatureValue,
  RapidApiReaListing,
} from "@/lib/rapidapi/types";

function nonEmpty(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function featureCount(
  direct: number | null | undefined,
  feature: RapidApiReaFeatureValue | number | null | undefined,
) {
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  if (typeof feature === "number" && Number.isFinite(feature)) return feature;
  if (
    feature &&
    typeof feature === "object" &&
    typeof feature.value === "number" &&
    Number.isFinite(feature.value)
  ) {
    return feature.value;
  }
  return undefined;
}

function numericPrice(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/\$?\s*([\d,.]+)\s*([km])?/);
  if (!match?.[1]) return undefined;
  const parsed = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  const multiplier = match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
  return parsed * multiplier;
}

function pricePeriod(channel?: string | null) {
  return channel?.trim().toLowerCase() === "rent" ? "week" : undefined;
}

function advertiserToAgent(advertiser: RapidApiReaAdvertiser) {
  const email = nonEmpty(advertiser.email);
  return {
    name: nonEmpty(advertiser.name),
    jobTitle: nonEmpty(advertiser.jobTitle),
    phoneNumber: nonEmpty(advertiser.phone),
    emails: email ? [email] : undefined,
    image: nonEmpty(advertiser.photo),
  };
}

function normalizedArea(
  area: RapidApiReaListing["land_size"] | RapidApiReaListing["building_size"],
) {
  if (area == null || typeof area === "number" || typeof area === "string") {
    return area ?? undefined;
  }
  return {
    value: area.value ?? undefined,
    unit: area.unit ?? undefined,
  };
}

function normalizedImages(listing: RapidApiReaListing) {
  return [
    ...new Set(
      [listing.main_image, ...(listing.images ?? [])]
        .map((url) => nonEmpty(url))
        .filter((url): url is string => Boolean(url)),
    ),
  ];
}

export function rapidApiReaListingToRecord(
  listing: RapidApiReaListing,
  originalSearchUrl?: string,
): ApifyReaListingRecord {
  const channel = nonEmpty(listing.channel)?.toLowerCase();
  const price = nonEmpty(listing.price) ?? (
    typeof listing.price_raw === "string"
      ? nonEmpty(listing.price_raw)
      : undefined
  );
  const priceValue = numericPrice(listing.price_raw) ?? numericPrice(price);
  const address = listing.address ?? {};
  const features = listing.general_features ?? {};

  return {
    source: "rapidapi_rea",
    country: "AU",
    listingId:
      listing.listing_id == null ? undefined : String(listing.listing_id),
    title: nonEmpty(listing.title),
    propertyType: nonEmpty(listing.property_type),
    channel,
    status:
      channel === "sold"
        ? "sold"
        : nonEmpty(listing.construction_status) ?? channel,
    price,
    address: nonEmpty(address.street),
    suburb: nonEmpty(address.suburb),
    postcode: nonEmpty(address.postcode),
    state: nonEmpty(address.state),
    bedrooms: featureCount(listing.beds, features.bedrooms),
    bathrooms: featureCount(listing.baths, features.bathrooms),
    carSpaces: featureCount(listing.parking, features.parkingSpaces),
    landSize: normalizedArea(listing.land_size),
    floorArea: normalizedArea(listing.building_size),
    soldDate: nonEmpty(listing.sold_date) ?? null,
    dateSold: nonEmpty(listing.sold_date) ?? null,
    description: nonEmpty(listing.description),
    isRent: listing.is_rent ?? channel === "rent",
    isBuy: listing.is_buy ?? (channel === "buy" || channel === "sold"),
    url: nonEmpty(listing.url) ?? nonEmpty(listing.short_url),
    images: normalizedImages(listing),
    agents: (listing.advertisers ?? [])
      .map(advertiserToAgent)
      .filter((agent) => agent.name),
    originalSearchUrl,
    listing: price || priceValue
      ? {
          price: {
            display: price,
            value: priceValue,
            period: pricePeriod(channel),
          },
        }
      : undefined,
  };
}
