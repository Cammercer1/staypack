import type { LtrEnrichmentJson, LtrRentalCompCard, ParsedListing } from "@/lib/types";

function compId(comp: { listingUrl?: string; address: string }, index: number) {
  if (comp.listingUrl) {
    return comp.listingUrl.replace(/[^a-z0-9]+/gi, "-").slice(-40) || `comp-${index}`;
  }
  return `comp-${index}-${comp.address.slice(0, 24)}`;
}

export function ltrEnrichmentFromParsed(listing: ParsedListing): LtrEnrichmentJson | null {
  const appraisal = listing.rentalAppraisal;
  const comps = listing.rentalComps ?? [];

  const suburbMarket = listing.ltrSuburbMarket ?? null;

  if (!appraisal?.weeklyMidpoint && comps.length === 0 && !suburbMarket) {
    return null;
  }

  const mappedComps: LtrRentalCompCard[] = comps.map((comp, index) => ({
    listing_id: compId(comp, index),
    name: comp.address,
    thumbnail_url: comp.imageUrl ?? "",
    listing_url: comp.listingUrl ?? "",
    bedrooms: comp.bedrooms ?? null,
    bathrooms: comp.bathrooms ?? null,
    weekly_rent: comp.weeklyRent,
    suburb: comp.suburb ?? null,
  }));

  return {
    comp_count: appraisal?.compCount ?? mappedComps.length,
    weekly_range: {
      p25: appraisal?.weeklyMin ?? null,
      p50: appraisal?.weeklyMidpoint ?? null,
      p75: appraisal?.weeklyMax ?? null,
    },
    comps: mappedComps,
    source: appraisal?.source,
    search_url: appraisal?.searchUrl,
    suburb_market: suburbMarket,
  };
}
