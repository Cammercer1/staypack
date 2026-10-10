import { fetchAirroiEstimate, type AirroiInput } from "@/lib/airroi/client";
import { alignStrSeasonality } from "@/lib/str/comparables";
import { fetchAirroiMarketOccupancy } from "@/lib/airroi/marketOccupancy";
import type { Listing, StrEnrichmentJson } from "@/lib/types";

/** AirROI is the sole provider for new estimates, including managed delivery. */
export async function fetchStrEstimate(input: AirroiInput, listing: Listing, previous?: StrEnrichmentJson | null) {
  const request = { ...input, property_type: listing.property_type, suburb: listing.suburb };
  const { estimate, enrichment } = await fetchAirroiEstimate(request);
  const occupancy = await fetchAirroiMarketOccupancy(request, listing, previous?.market_occupancy);
  return {
    estimate,
    enrichment: alignStrSeasonality({ ...enrichment, market_occupancy: occupancy,
      cost_cents: (enrichment.cost_cents ?? 20) + occupancy.cost_cents }, estimate.annualRevenue),
  };
}
