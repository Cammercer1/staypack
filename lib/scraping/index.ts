import type { ParsedListing } from "@/lib/types";
import { parseGenericListing } from "@/lib/scraping/parsers/generic";
import { parseJsonLdListing } from "@/lib/scraping/parsers/jsonLd";
import { parseOpenGraphListing } from "@/lib/scraping/parsers/openGraph";
import { parseRayWhiteListing } from "@/lib/scraping/parsers/rayWhite";

const PARSERS = [
  { name: "json_ld", parse: parseJsonLdListing },
  { name: "ray_white", parse: parseRayWhiteListing },
  { name: "open_graph", parse: parseOpenGraphListing },
  { name: "generic", parse: parseGenericListing },
] as const;

export function mergeParsedListings(base: ParsedListing, next: ParsedListing): ParsedListing {
  return {
    title: next.title ?? base.title,
    address: next.address ?? base.address,
    suburb: next.suburb ?? base.suburb,
    state: next.state ?? base.state,
    postcode: next.postcode ?? base.postcode,
    propertyType: next.propertyType ?? base.propertyType,
    bedrooms: next.bedrooms ?? base.bedrooms,
    bathrooms: next.bathrooms ?? base.bathrooms,
    carSpaces: next.carSpaces ?? base.carSpaces,
    description: next.description ?? base.description,
    displayPrice: next.displayPrice ?? base.displayPrice,
    images: [...new Set([...next.images, ...base.images])],
    agents: next.agents.length ? next.agents : base.agents,
    rentalAppraisal: next.rentalAppraisal ?? base.rentalAppraisal,
    outgoings: next.outgoings ?? base.outgoings,
    confidence:
      next.confidence === "high" || base.confidence === "high"
        ? "high"
        : next.confidence === "medium" || base.confidence === "medium"
          ? "medium"
          : "low",
    warnings: [...new Set([...base.warnings, ...next.warnings])],
  };
}

function mergeListings(base: ParsedListing, next: ParsedListing): ParsedListing {
  return {
    title: base.title ?? next.title,
    address: base.address ?? next.address,
    suburb: base.suburb ?? next.suburb,
    state: base.state ?? next.state,
    postcode: base.postcode ?? next.postcode,
    propertyType: base.propertyType ?? next.propertyType,
    bedrooms: base.bedrooms ?? next.bedrooms,
    bathrooms: base.bathrooms ?? next.bathrooms,
    carSpaces: base.carSpaces ?? next.carSpaces,
    description: base.description ?? next.description,
    displayPrice: base.displayPrice ?? next.displayPrice,
    images: base.images.length ? base.images : next.images,
    agents: base.agents.length ? base.agents : next.agents,
    rentalAppraisal: base.rentalAppraisal ?? next.rentalAppraisal,
    outgoings: base.outgoings ?? next.outgoings,
    confidence:
      base.confidence === "high" || next.confidence === "high"
        ? "high"
        : base.confidence === "medium" || next.confidence === "medium"
          ? "medium"
          : "low",
    warnings: [...new Set([...base.warnings, ...next.warnings])],
  };
}

function scoreListing(listing: ParsedListing) {
  let score = 0;
  if (listing.title) score += 1;
  if (listing.address) score += 2;
  if (listing.description) score += 1;
  if (listing.images.length) score += 2;
  if (listing.bedrooms != null) score += 1;
  return score;
}

export function parseListing(html: string, url: string) {
  let best: ParsedListing = {
    images: [],
    agents: [],
    confidence: "low",
    warnings: [],
  };
  let parserName: string = "generic";

  for (const parser of PARSERS) {
    const parsed = parser.parse(html, url);
    if (scoreListing(parsed) >= scoreListing(best)) {
      best = mergeListings(best, parsed);
      parserName = parser.name;
    }
  }

  if (!best.title && !best.description && !best.images.length) {
    best.warnings.push("Limited listing data extracted. Please review manually.");
  }

  return { listing: best, parserName };
}
