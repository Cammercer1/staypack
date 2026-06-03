import { resolvePropRadarPropertySegment } from "@/lib/propradar/resolvePropertySegment";
import type { PropRadarSuburbResponse } from "@/lib/propradar/types";
import type { LtrSuburbMarketJson } from "@/lib/types";

export function mapPropRadarSuburbToLtrMarket(
  response: PropRadarSuburbResponse,
  propertyType?: string,
): LtrSuburbMarketJson {
  const segment = resolvePropRadarPropertySegment(propertyType);
  const isUnit = segment === "unit";

  return {
    suburb: response.suburb,
    state: response.state,
    postcode: response.postcode ?? null,
    property_segment: segment,
    vacancy_rate_pct: response.market_dynamics?.vacancy_rate_pct ?? null,
    population: response.demographics?.population ?? null,
    renter_pct: response.demographics?.renter_pct ?? null,
    gross_yield_pct: isUnit
      ? (response.yields?.unit_gross_pct ?? null)
      : (response.yields?.house_gross_pct ?? null),
    median_weekly_rent: isUnit
      ? (response.medians?.unit_weekly_rent ?? null)
      : (response.medians?.house_weekly_rent ?? null),
    as_of: response.as_of ?? null,
    source: "propradar",
  };
}
