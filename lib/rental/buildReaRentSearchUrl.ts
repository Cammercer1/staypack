import { slugifySuburbSegment } from "@/lib/scraping/domain/addressMatch";

export type ReaRentSearchInput = {
  suburb: string;
  state: string;
  postcode: string;
  bedrooms: number;
  bathrooms?: number;
  carSpaces?: number;
  propertyType?: string;
  /**
   * REA amenity keywords (e.g. swimming pool, balcony). Often returns far fewer
   * comps and biases toward premium stock — omit unless you explicitly need them.
   */
  featureKeywords?: string[];
};

function reaPropertyTypeSegment(propertyType?: string) {
  const normalized = propertyType?.trim().toLowerCase() ?? "";
  if (normalized.includes("apartment") || normalized.includes("unit")) {
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
 * REA rent SERP for Bright Data `discover_new`.
 *
 * Matches live REA paths such as:
 * `/rent/property-unit+apartment-with-3-bedrooms-in-surfers+paradise,+qld+4217/list-1?...`
 *
 * We intentionally omit `keywords` / `checkedFeatures` — those refine the SERP
 * and often return too few comps (or premium-only stock).
 */
export function buildReaRentSearchUrl(input: ReaRentSearchInput) {
  const suburbSlug = slugifySuburbSegment(input.suburb);
  const state = input.state.trim().toLowerCase();
  const postcode = input.postcode.trim();
  const beds = Math.max(1, Math.round(input.bedrooms));

  const typeSegment = reaPropertyTypeSegment(input.propertyType);
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
