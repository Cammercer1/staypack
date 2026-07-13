import { formatReaRentPostcodeSegment } from "@/lib/rental/adjacentRentSearchPostcodes";
import type {
  BuildReaRentSearchUrlOptions,
  ReaRentSearchInput,
} from "@/lib/rental/buildReaRentSearchUrl";
import { slugifySuburbSegment } from "@/lib/scraping/domain/addressMatch";

export type ReaSaleChannel = "sold" | "buy";

/** Same search input shape as rent SERPs — suburb, beds, baths, parking, keywords. */
export type ReaSaleSearchInput = ReaRentSearchInput;

export type BuildReaSaleSearchUrlOptions = BuildReaRentSearchUrlOptions;

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

/**
 * REA sold / buy SERP URL, mirroring the rent search builder:
 * - sold: https://www.realestate.com.au/sold/{type}-with-{n}-bedrooms-in-{suburb},+{state}+{postcode}/list-1?...&activeSort=solddate
 * - buy:  https://www.realestate.com.au/buy/{...}/list-1?...&activeSort=relevance
 */
export function buildReaSaleSearchUrl(
  channel: ReaSaleChannel,
  input: ReaSaleSearchInput,
  options?: BuildReaSaleSearchUrlOptions,
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
    activeSort: channel === "sold" ? "solddate" : "relevance",
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

  return `https://www.realestate.com.au/${channel}/${pathPrefix}-in-${location}/list-1?${params.toString()}`;
}
