import type { ParsedListing } from "@/lib/types";
import { mergeListingAgents } from "@/lib/agents/agentContact";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";

export function mergeParsedListings(base: ParsedListing, next: ParsedListing): ParsedListing {
  return {
    title: next.title ?? base.title,
    address: next.address ?? base.address,
    suburb: next.suburb ?? base.suburb,
    state: next.state ?? base.state,
    postcode: next.postcode ?? base.postcode,
    propertyType: next.propertyType ?? base.propertyType,
    purpose: next.purpose ?? base.purpose,
    bedrooms: next.bedrooms ?? base.bedrooms,
    bathrooms: next.bathrooms ?? base.bathrooms,
    carSpaces: next.carSpaces ?? base.carSpaces,
    description: next.description ?? base.description,
    displayPrice: normalizeDisplayPrice(next.displayPrice ?? base.displayPrice),
    images: [...new Set([...next.images, ...base.images])],
    agents: mergeListingAgents(base.agents, next.agents),
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
