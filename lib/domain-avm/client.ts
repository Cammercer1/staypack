import { getRapidApiReaKey } from "@/lib/rapidapi/client";
import {
  domainListingMatchesAddress,
  parseStreetAddress,
} from "@/lib/scraping/domain/addressMatch";
import { propertyTypeFamily } from "@/lib/rental/computeRentBand";
import type {
  DomainAvm,
  DomainAvmConfidence,
  DomainAvmSaleComparable,
} from "@/lib/domain-avm/types";
import type { ParsedListing } from "@/lib/types";

const DEFAULT_DOMAIN_API_HOST = "domain-au.p.rapidapi.com";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CACHE_TTL_HOURS = 30 * 24;
const MIN_AUTOCOMPLETE_RELATIVE_SCORE = 90;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function confidence(value: unknown): DomainAvmConfidence {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === "high" || normalized === "medium") {
    return normalized;
  }
  return "low";
}

function positiveNumber(value: unknown) {
  const parsed = asNumber(value);
  return parsed != null && parsed > 0 ? parsed : undefined;
}

function positiveIntegerFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export function getRapidApiDomainHost() {
  return process.env.RAPIDAPI_DOMAIN_HOST?.trim() || DEFAULT_DOMAIN_API_HOST;
}

export function isDomainAvmEnabled() {
  return (
    process.env.RAPIDAPI_DOMAIN_AVM_ENABLED?.trim().toLowerCase() !== "false"
  );
}

export function hasDomainAvmConfig() {
  return isDomainAvmEnabled() && Boolean(getRapidApiReaKey());
}

function domainAvmCacheTtlMs() {
  return (
    positiveIntegerFromEnv(
      "RAPIDAPI_DOMAIN_AVM_TTL_HOURS",
      DEFAULT_CACHE_TTL_HOURS,
    ) *
    60 *
    60 *
    1000
  );
}

function isFreshDomainAvm(avm: DomainAvm) {
  const matchedAt = new Date(avm.matchedAt).getTime();
  return (
    Number.isFinite(matchedAt) &&
    Date.now() - matchedAt <= domainAvmCacheTtlMs()
  );
}

function listingAddressQuery(listing: ParsedListing) {
  const address = listing.address?.trim();
  if (!address) return "";

  const normalizedAddress = address.toLowerCase();
  const locality = [listing.suburb, listing.state, listing.postcode]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part) => !normalizedAddress.includes(part.toLowerCase()));

  return [address, ...locality].join(" ");
}

export async function fetchDomainJson(path: string, params: URLSearchParams) {
  const key = getRapidApiReaKey();
  if (!key) {
    throw new Error("RapidAPI key is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    positiveIntegerFromEnv("RAPIDAPI_DOMAIN_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
  );

  try {
    const response = await fetch(
      `https://${getRapidApiDomainHost()}${path}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": getRapidApiDomainHost(),
        },
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const detail = body.trim().slice(0, 240);
      throw new Error(
        `Domain AVM request failed (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function candidateMatchesListing(candidate: JsonObject, listing: ParsedListing) {
  const target = parseStreetAddress(listing);
  const displayAddress = asString(candidate.address);
  const street = displayAddress ??
    [
      asString(candidate.unitNumber),
      asString(candidate.streetNumber),
      asString(candidate.streetName),
      asString(candidate.streetTypeLong) ?? asString(candidate.streetType),
    ]
      .filter(Boolean)
      .join(" ");

  return domainListingMatchesAddress(
    {
      street,
      suburb: asString(candidate.suburb),
      state: asString(candidate.state),
      postcode: asString(candidate.postcode),
    },
    target,
  );
}

function detailAddress(details: JsonObject) {
  const address = asObject(details.address);
  if (!address) return null;
  const displayAddress = asString(address.displayAddress);
  const street =
    displayAddress ??
    [
      asString(address.unitNumber),
      asString(address.streetNumber),
      asString(address.street),
    ]
      .filter(Boolean)
      .join(" ");

  return {
    displayAddress: displayAddress ?? street,
    street,
    suburb: asString(address.suburbName),
    state: asString(address.state),
    postcode: asString(address.postcode),
  };
}

function detailsMatchListing(details: JsonObject, listing: ParsedListing) {
  const address = detailAddress(details);
  if (!address) return false;

  if (
    !domainListingMatchesAddress(
      {
        street: address.street,
        suburb: address.suburb,
        state: address.state,
        postcode: address.postcode,
      },
      parseStreetAddress(listing),
    )
  ) {
    return false;
  }

  const listingFamily = propertyTypeFamily(listing.propertyType);
  const detailsFamily = propertyTypeFamily(asString(details.type));
  if (
    listingFamily !== "other" &&
    detailsFamily !== "other" &&
    listingFamily !== detailsFamily
  ) {
    return false;
  }

  const bedrooms = positiveNumber(details.bedrooms);
  return !(
    listing.bedrooms != null &&
    bedrooms != null &&
    Math.abs(listing.bedrooms - bedrooms) > 1
  );
}

function nestedImageUrl(photo: JsonObject) {
  const direct = asString(photo.fullUrl);
  if (direct) return direct;
  const image = asObject(photo.image);
  if (!image) return undefined;
  for (const value of Object.values(image)) {
    const url = asString(value);
    if (url?.startsWith("http")) return url;
  }
  return undefined;
}

function normalizeComparable(value: unknown): DomainAvmSaleComparable | null {
  const comp = asObject(value);
  if (!comp) return null;
  const address = asString(comp.address);
  if (!address) return null;

  const activity = asObject(comp.lastSaleActivity);
  const photos = asArray(comp.photos);
  const firstPhoto = asObject(photos[0]);

  return {
    slug: asString(comp.slug),
    address,
    bedrooms: positiveNumber(comp.bedrooms),
    bathrooms: positiveNumber(comp.bathrooms),
    carSpaces: asNumber(comp.carSpaces),
    soldDate: asString(activity?.date),
    soldPrice: positiveNumber(activity?.price),
    imageUrl: firstPhoto ? nestedImageUrl(firstPhoto) : undefined,
  };
}

export function normalizeDomainAvm(
  details: JsonObject,
  urlSlug: string,
): DomainAvm {
  const address = detailAddress(details);
  const valuation = asObject(details.valuation);
  const rental = asObject(details.rentalEstimate);
  const performance = asObject(details.suburbPerformance);
  const statistics = asObject(performance?.statistics);

  const lowerPrice = positiveNumber(valuation?.lowerPrice);
  const midPrice = positiveNumber(valuation?.midPrice);
  const upperPrice = positiveNumber(valuation?.upperPrice);
  const weeklyRent = positiveNumber(rental?.weeklyRentEstimate);

  return {
    propertyId:
      asString(details.propertyId) ??
      asString(details.id),
    urlSlug,
    address: address?.displayAddress ?? urlSlug,
    propertyType: asString(details.type),
    bedrooms: positiveNumber(details.bedrooms),
    bathrooms: positiveNumber(details.bathrooms),
    carSpaces: asNumber(details.parkingSpaces),
    floorAreaSqm: positiveNumber(
      details['internalArea({"unit":"SQUARE_METERS"})'],
    ),
    landAreaSqm: positiveNumber(
      details['landArea({"unit":"SQUARE_METERS"})'],
    ),
    valuation:
      lowerPrice != null && midPrice != null && upperPrice != null
        ? {
            lowerPrice,
            midPrice,
            upperPrice,
            confidence: confidence(valuation?.priceConfidence),
            source: asString(valuation?.source),
            date: asString(valuation?.date),
          }
        : undefined,
    rentalEstimate:
      weeklyRent != null
        ? {
            weeklyRent,
            confidence: confidence(rental?.rentalFsdConfidence),
            date: asString(rental?.estimateDate),
            yieldPct: positiveNumber(rental?.percentYieldRentEstimate),
          }
        : undefined,
    suburbMarket: statistics
      ? {
          medianSoldPrice: positiveNumber(statistics.medianSoldPrice),
          medianWeeklyRent: positiveNumber(statistics.medianRentListingPrice),
          daysOnMarket: positiveNumber(statistics.daysOnMarket),
        }
      : undefined,
    comparableSales: asArray(details.comparableSales)
      .map(normalizeComparable)
      .filter((comp): comp is DomainAvmSaleComparable => Boolean(comp)),
    matchedAt: new Date().toISOString(),
  };
}

/** Fetches an exact-address Domain property profile and its AVM evidence. */
export async function fetchDomainAvmForListing(
  listing: ParsedListing,
): Promise<DomainAvm | null> {
  if (!hasDomainAvmConfig()) return null;

  const query = listingAddressQuery(listing);
  if (!query) return null;

  const autocompleteResponse = asObject(
    await fetchDomainJson(
      "/estimates/auto-complete",
      new URLSearchParams({ query }),
    ),
  );
  const candidates = asArray(autocompleteResponse?.data)
    .map(asObject)
    .filter((candidate): candidate is JsonObject => Boolean(candidate))
    .filter(
      (candidate) =>
        (asNumber(candidate.relativeScore) ?? 0) >=
          MIN_AUTOCOMPLETE_RELATIVE_SCORE &&
        candidateMatchesListing(candidate, listing),
    )
    .sort(
      (a, b) =>
        (asNumber(b.relativeScore) ?? 0) -
        (asNumber(a.relativeScore) ?? 0),
    );

  const urlSlug = asString(candidates[0]?.urlSlug);
  if (!urlSlug) return null;

  const detailResponse = asObject(
    await fetchDomainJson(
      "/estimates/details",
      new URLSearchParams({ query: urlSlug }),
    ),
  );
  const data = asObject(detailResponse?.data);
  const details = asObject(data?.propertyDetails);
  if (!details || !detailsMatchListing(details, listing)) {
    return null;
  }

  return normalizeDomainAvm(details, urlSlug);
}

/** Reuses persisted AVM data; callers persist the returned listing normally. */
export async function enrichListingWithDomainAvm(
  listing: ParsedListing,
): Promise<{
  listing: ParsedListing;
  status: "cached" | "fetched" | "disabled" | "unavailable" | "failed";
  error?: string;
}> {
  if (!isDomainAvmEnabled()) {
    return {
      listing: { ...listing, domainAvm: undefined },
      status: "disabled",
    };
  }
  if (listing.domainAvm && isFreshDomainAvm(listing.domainAvm)) {
    return { listing, status: "cached" };
  }
  if (!hasDomainAvmConfig()) {
    return {
      listing: { ...listing, domainAvm: undefined },
      status: "unavailable",
    };
  }

  try {
    const domainAvm = await fetchDomainAvmForListing(listing);
    if (!domainAvm) {
      return {
        listing: { ...listing, domainAvm: undefined },
        status: "unavailable",
      };
    }
    return {
      listing: { ...listing, domainAvm },
      status: "fetched",
    };
  } catch (error) {
    return {
      listing: { ...listing, domainAvm: undefined },
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown Domain AVM error",
    };
  }
}
