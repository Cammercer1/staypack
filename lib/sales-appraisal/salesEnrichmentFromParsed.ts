import { saleCompListingId } from "@/lib/sales-appraisal/saleCompIds";
import {
  orderSalesAppraisalCompPool,
  resolveSelectedSaleComps,
} from "@/lib/sales-appraisal/salesAppraisalData";
import { reportableSaleLandArea } from "@/lib/sales/reportableSaleArea";
import type { ParsedListing, SaleCompCard, SalesEnrichmentJson } from "@/lib/types";

export function salesEnrichmentFromParsed(
  listing: ParsedListing,
): SalesEnrichmentJson | null {
  const appraisal = listing.salesAppraisal;
  const compPool = orderSalesAppraisalCompPool(listing);
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
    car_spaces: comp.carSpaces ?? null,
    property_type: comp.propertyType ?? null,
    price: comp.price,
    price_display: comp.priceDisplay ?? null,
    sale_status: comp.saleStatus,
    sold_date: comp.soldDate ?? null,
    land_area_sqm: reportableSaleLandArea(
      comp.propertyType,
      comp.landAreaSqm,
    ),
    floor_area_sqm: comp.floorAreaSqm ?? null,
    suburb: comp.suburb ?? null,
  }));

  return {
    comp_count: Math.max(appraisal?.compCount ?? 0, compPool.length),
    sold_comp_count:
      appraisal?.soldCompCount ??
      compPool.filter((comp) => comp.saleStatus === "sold").length,
    for_sale_comp_count:
      appraisal?.forSaleCompCount ??
      compPool.filter((comp) => comp.saleStatus === "for_sale").length,
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
