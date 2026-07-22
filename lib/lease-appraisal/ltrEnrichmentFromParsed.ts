import { rentalCompListingId } from "@/lib/lease-appraisal/rentalCompIds";
import {
  orderLeaseAppraisalCompPool,
  resolveSelectedRentalComps,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import { resolveRentalCompPropertyType } from "@/lib/rental/resolveRentalCompPropertyType";
import type { LtrEnrichmentJson, LtrRentalCompCard, ParsedListing } from "@/lib/types";

export function ltrEnrichmentFromParsed(listing: ParsedListing): LtrEnrichmentJson | null {
  const appraisal = listing.rentalAppraisal;
  const compPool = orderLeaseAppraisalCompPool(listing);
  const comps = resolveSelectedRentalComps(listing);

  const suburbMarket = listing.ltrSuburbMarket ?? null;

  if (!appraisal?.weeklyMidpoint && comps.length === 0 && !suburbMarket) {
    return null;
  }

  const mappedComps: LtrRentalCompCard[] = comps.map((comp, index) => ({
    listing_id: rentalCompListingId(comp, index),
    name: comp.address,
    thumbnail_url: comp.imageUrl ?? "",
    listing_url: comp.listingUrl ?? "",
    bedrooms: comp.bedrooms ?? null,
    bathrooms: comp.bathrooms ?? null,
    car_spaces: comp.carSpaces ?? null,
    property_type: resolveRentalCompPropertyType(comp) ?? null,
    weekly_rent: comp.weeklyRent,
    suburb: comp.suburb ?? null,
  }));

  return {
    comp_count: Math.max(appraisal?.compCount ?? 0, compPool.length),
    weekly_range: {
      p25: appraisal?.weeklyMin ?? null,
      p50: appraisal?.weeklyMidpoint ?? null,
      p75: appraisal?.weeklyMax ?? null,
    },
    comps: mappedComps,
    source: appraisal?.source,
    search_url: appraisal?.searchUrl,
    suburb_market: suburbMarket,
    positioning: appraisal?.positioning ?? null,
  };
}
