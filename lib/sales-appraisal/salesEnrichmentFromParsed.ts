import { saleCompListingId } from "@/lib/sales-appraisal/saleCompIds";
import { resolveSelectedSaleComps } from "@/lib/sales-appraisal/salesAppraisalData";
import type { ParsedListing, SaleCompCard, SalesEnrichmentJson } from "@/lib/types";

export function salesEnrichmentFromParsed(
  listing: ParsedListing,
): SalesEnrichmentJson | null {
  const appraisal = listing.salesAppraisal;
  const comps = resolveSelectedSaleComps(listing);

  if (!appraisal?.priceMidpoint && comps.length === 0) {
    return null;
  }

  const mappedComps: SaleCompCard[] = comps.map((comp, index) => ({
    listing_id: saleCompListingId(comp, index),
    name: comp.address,
    thumbnail_url: comp.imageUrl ?? "",
    listing_url: comp.listingUrl ?? "",
    bedrooms: comp.bedrooms ?? null,
    bathrooms: comp.bathrooms ?? null,
    price: comp.price,
    price_display: comp.priceDisplay ?? null,
    sale_status: comp.saleStatus,
    sold_date: comp.soldDate ?? null,
    suburb: comp.suburb ?? null,
  }));

  return {
    comp_count: appraisal?.compCount ?? mappedComps.length,
    sold_comp_count:
      appraisal?.soldCompCount ??
      mappedComps.filter((comp) => comp.sale_status === "sold").length,
    for_sale_comp_count:
      appraisal?.forSaleCompCount ??
      mappedComps.filter((comp) => comp.sale_status === "for_sale").length,
    price_range: {
      p25: appraisal?.priceMin ?? null,
      p50: appraisal?.priceMidpoint ?? null,
      p75: appraisal?.priceMax ?? null,
    },
    comps: mappedComps,
    source: appraisal?.source,
    search_url: appraisal?.searchUrl,
    positioning: appraisal?.positioning ?? null,
  };
}
