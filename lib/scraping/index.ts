import type { ParsedListing } from "@/lib/types";
import { mergeListingAgents } from "@/lib/agents/agentContact";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import { parsersForUrl } from "@/lib/scraping/parsers/registry";

export { mergeParsedListings } from "@/lib/scraping/mergeParsedListings";

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
    displayPrice: normalizeDisplayPrice(base.displayPrice ?? next.displayPrice),
    soldDate: base.soldDate ?? next.soldDate,
    landAreaSqm: base.landAreaSqm ?? next.landAreaSqm,
    floorAreaSqm: base.floorAreaSqm ?? next.floorAreaSqm,
    images:
      next.images.length > base.images.length
        ? next.images
        : base.images.length
          ? base.images
          : next.images,
    agents: mergeListingAgents(base.agents, next.agents),
    rentalAppraisal: base.rentalAppraisal ?? next.rentalAppraisal,
    rentalComps: base.rentalComps?.length ? base.rentalComps : next.rentalComps,
    salesAppraisal: base.salesAppraisal ?? next.salesAppraisal,
    salesComps: base.salesComps?.length ? base.salesComps : next.salesComps,
    salesAppraisalEnrichment:
      base.salesAppraisalEnrichment ?? next.salesAppraisalEnrichment,
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
  const parsers = parsersForUrl(url);
  let best: ParsedListing = {
    images: [],
    agents: [],
    confidence: "low",
    warnings: [],
  };
  let parserName = parsers[parsers.length - 1]?.name ?? "generic";

  for (const parser of parsers) {
    const parsed = parser.parse(html, url);
    if (scoreListing(parsed) >= scoreListing(best)) {
      best = mergeListings(best, parsed);
      parserName = parser.name;
    } else if (scoreListing(parsed) > 0) {
      best = mergeListings(best, parsed);
    }
  }

  if (!best.title && !best.description && !best.images.length) {
    best.warnings.push("Limited listing data extracted. Please review manually.");
  }

  return { listing: best, parserName };
}
