import type { DomainSuburbRentMedian } from "@/lib/scraping/domain/fetchDomainSuburbRentMedian";
import type { RentalComp } from "@/lib/rental/types";
import type { LtrSuburbMarketJson } from "@/lib/types";

export type SuburbRentFloorSource =
  | "domain_bed_median"
  | "rea_bed_median"
  | "propradar_house_median";

export type SuburbRentFloor = {
  weeklyRent: number;
  source: SuburbRentFloorSource;
};

function percentile(sorted: number[], p: number) {
  if (!sorted.length) {
    return 0;
  }
  const index = Math.floor((sorted.length - 1) * p);
  return sorted[index] ?? sorted[0]!;
}

function bedroomRents(comps: RentalComp[], bedrooms: number) {
  return comps
    .filter((comp) => comp.weeklyRent > 0 && comp.bedrooms === bedrooms)
    .map((comp) => comp.weeklyRent)
    .sort((a, b) => a - b);
}

/** Median weekly rent for listings matching subject bedrooms (before premium trimming). */
export function computeReaBedroomRentMedian(
  comps: RentalComp[],
  bedrooms: number,
): number | null {
  const rents = bedroomRents(comps, bedrooms);
  if (rents.length < 5) {
    return null;
  }
  return percentile(rents, 0.5);
}

export function computeReaBedroomRentPercentile(
  comps: RentalComp[],
  bedrooms: number,
  p: number,
): number | null {
  const rents = bedroomRents(comps, bedrooms);
  if (rents.length < 5) {
    return null;
  }
  return percentile(rents, p);
}

/**
 * PropRadar only publishes all-house / all-unit medians — scale house median slightly
 * for 4+ bed subjects when no Domain row is available.
 */
export function propradarHouseRentFloor(
  market: LtrSuburbMarketJson | null | undefined,
  bedrooms: number,
): number | null {
  const median = market?.median_weekly_rent;
  if (median == null || !Number.isFinite(median) || median <= 0) {
    return null;
  }

  if (market?.property_segment !== "house") {
    return null;
  }

  if (bedrooms >= 5) {
    return Math.round(median * 1.15);
  }
  if (bedrooms >= 4) {
    return Math.round(median * 1.08);
  }

  return Math.round(median);
}

export function resolveSuburbRentFloor(input: {
  domainMedian: DomainSuburbRentMedian | null;
  reaBedMedian: number | null;
  reaBedP75?: number | null;
  suburbMarket: LtrSuburbMarketJson | null | undefined;
  bedrooms: number;
  premium: boolean;
}): SuburbRentFloor | null {
  if (input.domainMedian?.weeklyRent) {
    return {
      weeklyRent: input.domainMedian.weeklyRent,
      source: "domain_bed_median",
    };
  }

  const reaFloor =
    input.premium && input.reaBedP75 != null
      ? input.reaBedP75
      : input.reaBedMedian;

  if (reaFloor != null) {
    return {
      weeklyRent: Math.round(reaFloor),
      source: "rea_bed_median",
    };
  }

  const propRadar = propradarHouseRentFloor(input.suburbMarket, input.bedrooms);
  if (propRadar != null) {
    return {
      weeklyRent: propRadar,
      source: "propradar_house_median",
    };
  }

  return null;
}
