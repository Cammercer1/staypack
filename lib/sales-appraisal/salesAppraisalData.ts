import { saleCompListingId } from "@/lib/sales-appraisal/saleCompIds";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import {
  filterSaleCompsForSubjectType,
  rankSaleCompsForSubject,
} from "@/lib/sales/rankSaleCompsForSubject";
import type { SaleComp } from "@/lib/sales/types";
import type { ParsedListing } from "@/lib/types";

/** Page 2 comparable grid (2×3). */
export const MAX_SALES_APPRAISAL_FEATURED_COMPS = 6;

function saleCompPool(parsed: ParsedListing): SaleComp[] {
  return (parsed.salesComps ?? []) as SaleComp[];
}

export function hasSalesAppraisalSelectedComps(
  parsed: ParsedListing | null | undefined,
): boolean {
  const ids = parsed?.salesAppraisal?.selectedCompListingIds;
  return Boolean(ids && ids.length > 0);
}

export function buildSaleCompIdLookup(parsed: ParsedListing) {
  const fullPool = saleCompPool(parsed);
  const ordered = orderSalesAppraisalCompPool(parsed);
  const map = new Map<string, SaleComp>();

  const register = (comp: SaleComp, index: number) => {
    map.set(saleCompListingId(comp, index), comp);
    const url = comp.listingUrl?.trim();
    if (url) {
      map.set(url, comp);
    }
  };

  fullPool.forEach((comp, index) => register(comp, index));
  ordered.forEach((comp, index) => register(comp, index));

  return map;
}

export function defaultSelectedSaleCompListingIds(
  parsed: ParsedListing,
): string[] {
  const ordered = orderSalesAppraisalCompPool(parsed);
  return ordered
    .slice(0, MAX_SALES_APPRAISAL_FEATURED_COMPS)
    .map((comp, index) => saleCompListingId(comp, index));
}

export function orderSalesAppraisalCompPool(parsed: ParsedListing): SaleComp[] {
  const pool = saleCompPool(parsed);
  const subjectPropertyType = resolveRentSubjectPropertyType(parsed);
  const eligible = filterSaleCompsForSubjectType(pool, subjectPropertyType);
  return rankSaleCompsForSubject(eligible, {
    suburb: parsed.suburb,
    bedrooms: parsed.bedrooms ?? undefined,
    bathrooms: parsed.bathrooms ?? undefined,
    subjectPropertyType,
  });
}

export function resolveSelectedSaleComps(parsed: ParsedListing): SaleComp[] {
  const pool = orderSalesAppraisalCompPool(parsed);
  const selectedIds = parsed.salesAppraisal?.selectedCompListingIds;

  if (!selectedIds?.length) {
    return pool.slice(0, MAX_SALES_APPRAISAL_FEATURED_COMPS);
  }

  const byId = buildSaleCompIdLookup(parsed);
  const seen = new Set<SaleComp>();
  const ordered = selectedIds
    .map((id) => byId.get(id))
    .filter((comp): comp is NonNullable<typeof comp> => {
      if (!comp || seen.has(comp)) {
        return false;
      }
      seen.add(comp);
      return true;
    })
    .slice(0, MAX_SALES_APPRAISAL_FEATURED_COMPS);

  return ordered.length > 0
    ? ordered
    : pool.slice(0, MAX_SALES_APPRAISAL_FEATURED_COMPS);
}

export function applySalesAppraisalPriceOverrides(
  parsed: ParsedListing,
  overrides: {
    priceMin?: number | null;
    priceMax?: number | null;
    priceMidpoint?: number | null;
  },
): ParsedListing {
  const appraisal = parsed.salesAppraisal ?? {};
  return {
    ...parsed,
    salesAppraisal: {
      ...appraisal,
      priceMin: overrides.priceMin ?? appraisal.priceMin,
      priceMax: overrides.priceMax ?? appraisal.priceMax,
      priceMidpoint: overrides.priceMidpoint ?? appraisal.priceMidpoint,
    },
  };
}

export function applySalesAppraisalCompSelection(
  parsed: ParsedListing,
  selectedCompListingIds: string[],
): ParsedListing {
  const unique = [
    ...new Set(
      selectedCompListingIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_SALES_APPRAISAL_FEATURED_COMPS);

  return {
    ...parsed,
    salesAppraisal: {
      ...parsed.salesAppraisal,
      selectedCompListingIds: unique,
      compCount: unique.length || parsed.salesAppraisal?.compCount,
    },
  };
}
