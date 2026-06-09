import { formatReaRentPostcodeSegment } from "@/lib/rental/adjacentRentSearchPostcodes";
import { slugifySuburbSegment } from "@/lib/scraping/domain/addressMatch";

export type ReaRentSearchInput = {
  suburb: string;
  state: string;
  postcode: string;
  /** Extra postcodes for REA multi-postcode SERPs (e.g. adjacent 6019;6021). */
  additionalPostcodes?: string[];
  bedrooms: number;
  bathrooms?: number;
  carSpaces?: number;
  propertyType?: string;
  /**
   * REA amenity keywords (e.g. luxury, pool). Narrows SERP toward premium stock.
   */
  featureKeywords?: string[];
};

export type BuildReaRentSearchUrlOptions = {
  /**
   * When false, uses `with-{n}-bedrooms` (no property-type segment).
   * Typed lease discovery always keeps the type segment when propertyType is set.
   */
  includePropertyTypeInPath?: boolean;
};

function reaPropertyTypeSegment(propertyType?: string) {
  const normalized = propertyType?.trim().toLowerCase() ?? "";
  if (normalized.includes("apartment") || normalized.includes("unit") || normalized.includes("flat")) {
    return "property-unit+apartment";
  }
  if (normalized.includes("townhouse")) {
    return "property-townhouse";
  }
  if (normalized.includes("house") || normalized.includes("villa")) {
    return "property-house";
  }
  return null;
}

export function buildReaRentSearchUrl(
  input: ReaRentSearchInput,
  options?: BuildReaRentSearchUrlOptions,
) {
  const suburbSlug = slugifySuburbSegment(input.suburb);
  const state = input.state.trim().toLowerCase();
  const postcode = formatReaRentPostcodeSegment(
    input.postcode,
    input.additionalPostcodes,
  );
  const beds = Math.max(1, Math.round(input.bedrooms));

  const includeType =
    options?.includePropertyTypeInPath !== false && Boolean(input.propertyType?.trim());
  const typeSegment = includeType ? reaPropertyTypeSegment(input.propertyType) : null;
  const pathPrefix = typeSegment
    ? `${typeSegment}-with-${beds}-bedrooms`
    : `with-${beds}-bedrooms`;

  const location = `${suburbSlug},+${state}+${postcode}`;
  const params = new URLSearchParams({
    maxBeds: String(beds),
    activeSort: "list-date",
    source: "refinement",
  });

  if (input.bathrooms != null && input.bathrooms > 0) {
    params.set("numBaths", String(Math.round(input.bathrooms)));
  }

  if (input.carSpaces != null && input.carSpaces > 0) {
    params.set("numParkingSpaces", String(Math.round(input.carSpaces)));
  }

  const keywords = (input.featureKeywords ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  if (keywords.length) {
    const joined = keywords.join(",");
    params.set("keywords", joined);
    params.set("checkedFeatures", joined);
  }

  return `https://www.realestate.com.au/rent/${pathPrefix}-in-${location}/list-1?${params.toString()}`;
}
