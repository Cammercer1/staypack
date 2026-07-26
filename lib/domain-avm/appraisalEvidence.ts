import type { DomainAvm, DomainAvmConfidence } from "@/lib/domain-avm/types";
import type { RentBandResult } from "@/lib/rental/computeRentBand";
import type { RentalComp } from "@/lib/rental/types";
import {
  roundSalePrice,
  type SalePriceBandResult,
} from "@/lib/sales/computeSalePriceBand";
import type { SaleComp } from "@/lib/sales/types";
import { filterRecentSaleComps } from "@/lib/sales/saleCompFreshness";
import type { ParsedListing } from "@/lib/types";

export function isTrustedDomainConfidence(
  value?: DomainAvmConfidence,
): value is "high" | "medium" {
  return value === "high" || value === "medium";
}

function roundWeeklyRent(value: number) {
  return Math.round(value / 5) * 5;
}

function median(values: number[]) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function compSuburb(address: string) {
  const parts = address.split(",").map((part) => part.trim());
  return parts.length >= 2 ? parts.at(-2) : undefined;
}

export function domainAvmSaleComps(
  avm: DomainAvm | undefined,
  listing: ParsedListing,
): SaleComp[] {
  const target = avm?.valuation?.midPrice;
  if (!avm || target == null || !isTrustedDomainConfidence(avm.valuation?.confidence)) {
    return [];
  }

  const mapped: SaleComp[] = avm.comparableSales
    .filter((comp) => comp.soldPrice != null && comp.soldDate)
    .filter(
      (comp) =>
        listing.bedrooms == null ||
        comp.bedrooms == null ||
        comp.bedrooms === listing.bedrooms,
    )
    .filter(
      (comp) =>
        listing.bathrooms == null ||
        comp.bathrooms == null ||
        Math.abs(comp.bathrooms - listing.bathrooms) <= 1,
    )
    .filter(
      (comp) =>
        comp.soldPrice! >= target * 0.65 &&
        comp.soldPrice! <= target * 1.35,
    )
    .map((comp) => ({
      address: comp.address,
      suburb: compSuburb(comp.address) ?? listing.suburb,
      price: comp.soldPrice!,
      saleStatus: "sold",
      soldDate: comp.soldDate,
      bedrooms: comp.bedrooms,
      bathrooms: comp.bathrooms,
      carSpaces: comp.carSpaces,
      propertyType: avm.propertyType ?? listing.propertyType,
      imageUrl: comp.imageUrl,
      listingUrl: comp.slug
        ? `https://www.domain.com.au/property-profile/${comp.slug}`
        : undefined,
      provider: "domain_avm",
    }));

  return filterRecentSaleComps(mapped);
}

export function filterSaleCompsAroundDomainAvm(
  comps: SaleComp[],
  avm?: DomainAvm,
): SaleComp[] {
  const valuation = avm?.valuation;
  if (
    !valuation ||
    !isTrustedDomainConfidence(valuation.confidence)
  ) {
    return comps;
  }
  const near = comps.filter(
    (comp) =>
      comp.price >= valuation.midPrice * 0.65 &&
      comp.price <= valuation.midPrice * 1.35,
  );
  return near.length >= 4 ? near : comps;
}

export function anchorSaleBandToDomainAvm(
  band: SalePriceBandResult,
  avm?: DomainAvm,
): SalePriceBandResult {
  const valuation = avm?.valuation;
  if (!valuation || !isTrustedDomainConfidence(valuation.confidence)) {
    return band;
  }

  const evidenceMidpoint = median([band.priceMidpoint]);
  const midpoint = roundSalePrice(
    valuation.confidence === "high" || evidenceMidpoint == null
      ? valuation.midPrice
      : (valuation.midPrice * 2 + evidenceMidpoint) / 3,
  );
  const spread = valuation.confidence === "high" ? 0.05 : 0.08;
  const priceMin = roundSalePrice(
    Math.max(valuation.lowerPrice, midpoint * (1 - spread)),
  );
  const priceMax = roundSalePrice(
    Math.min(valuation.upperPrice, midpoint * (1 + spread)),
  );

  return {
    ...band,
    priceMin: Math.min(priceMin, priceMax),
    priceMax: Math.max(priceMin, priceMax),
    priceMidpoint: midpoint,
  };
}

export function filterRentalCompsAroundDomainAvm(
  comps: RentalComp[],
  avm?: DomainAvm,
): RentalComp[] {
  const estimate = avm?.rentalEstimate;
  if (!estimate || !isTrustedDomainConfidence(estimate.confidence)) {
    return comps;
  }
  const near = comps.filter(
    (comp) =>
      comp.weeklyRent >= estimate.weeklyRent * 0.75 &&
      comp.weeklyRent <= estimate.weeklyRent * 1.25,
  );
  return near.length >= 4 ? near : comps;
}

export function anchorRentBandToDomainAvm(
  band: RentBandResult,
  avm?: DomainAvm,
): RentBandResult {
  const estimate = avm?.rentalEstimate;
  if (!estimate || !isTrustedDomainConfidence(estimate.confidence)) {
    return band;
  }

  const evidenceMidpoint = median([band.weeklyMidpoint]);
  const weeklyMidpoint = roundWeeklyRent(
    estimate.confidence === "high" || evidenceMidpoint == null
      ? estimate.weeklyRent
      : (estimate.weeklyRent * 2 + evidenceMidpoint) / 3,
  );
  const spread = estimate.confidence === "high" ? 0.04 : 0.07;
  const weeklyMin = roundWeeklyRent(weeklyMidpoint * (1 - spread));
  const weeklyMax = roundWeeklyRent(weeklyMidpoint * (1 + spread));

  return {
    ...band,
    weeklyMin: Math.min(weeklyMin, weeklyMax),
    weeklyMax: Math.max(weeklyMin, weeklyMax),
    weeklyMidpoint,
  };
}
