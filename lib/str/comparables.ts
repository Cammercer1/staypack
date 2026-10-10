import type { StrCompCard, StrEnrichmentJson } from "@/lib/types";

export const MAX_STR_FEATURED_COMPS = 6;

export function propertyCategory(value: string | null | undefined) {
  if (!value) return null;
  if (/apartment|unit|condo|flat/i.test(value)) return "apartment";
  if (/house|home|villa|townhouse/i.test(value)) return "house";
  return null;
}

export function rankStrComps(comps: StrCompCard[], subject: {
  bedrooms: number; bathrooms: number; accommodates: number;
  property_type?: string | null; suburb?: string | null;
}) {
  const category = propertyCategory(subject.property_type);
  const score = (comp: StrCompCard) =>
    (comp.bedrooms === subject.bedrooms ? 100 : -100) +
    (category && propertyCategory(comp.property_type) === category ? 60 : 0) +
    (subject.suburb && comp.suburb?.toLowerCase() === subject.suburb.toLowerCase() ? 20 : 0) -
    Math.abs((comp.bathrooms ?? 0) - subject.bathrooms) * 8 -
    Math.abs((comp.accommodates ?? 0) - subject.accommodates) * 5 -
    (comp.distance_m ?? 10000) / 300 -
    ((comp.reviews ?? 0) < 10 ? 8 : 0) -
    (comp.occupancy_rate != null && comp.occupancy_rate < 20 ? 40 : 0) -
    (comp.blocked_nights != null && comp.blocked_nights > 90 ? 15 : 0);
  return comps.filter((c) => !c.room_type || c.room_type === "entire_home")
    .map((comp) => ({ ...comp, match_notes: [
      ...(comp.bedrooms !== subject.bedrooms ? ["Different bedroom count"] : []),
      ...(category && propertyCategory(comp.property_type) !== category ? ["Different or unknown property type"] : []),
      ...(comp.occupancy_rate != null && comp.occupancy_rate < 20 ? ["Limited booked activity"] : []),
      ...(comp.reviews != null && comp.reviews < 10 ? ["Limited review history"] : []),
      ...(comp.blocked_nights && comp.blocked_nights > 90 ? ["Substantial blocked availability"] : []),
    ] }))
    .sort((a, b) => score(b) - score(a) || a.listing_id.localeCompare(b.listing_id));
}

/** Selection changes report evidence only; it never reprices an estimate. */
export function selectStrComps(enrichment: StrEnrichmentJson, ids: string[]): StrEnrichmentJson {
  const pool = enrichment.comp_pool ?? enrichment.comps;
  if (ids.length < 1 || ids.length > MAX_STR_FEATURED_COMPS || new Set(ids).size !== ids.length) {
    throw new Error("Select between one and six unique comparables");
  }
  const comps = ids.map((id) => {
    const comp = pool.find((candidate) => candidate.listing_id === id);
    if (!comp) throw new Error("A selected comparable is no longer available. Refresh the evidence.");
    return comp;
  });
  return { ...enrichment, comp_pool: pool, selected_comp_ids: ids, comps };
}

/** Modelled revenue allocation only; do not invent monthly occupancy or ADR. */
export function alignStrSeasonality(enrichment: StrEnrichmentJson, annualRevenue: number | null) {
  if (enrichment.seasonality_basis !== "modelled" || annualRevenue == null) return enrichment;
  const total = enrichment.seasonality.reduce((sum, row) => sum + (row.revenue ?? 0), 0);
  if (total <= 0) return enrichment;
  let allocated = 0;
  const seasonality = enrichment.seasonality.map((row, index, rows) => {
    const revenue = index === rows.length - 1 ? Math.round(annualRevenue) - allocated
      : Math.round((row.revenue ?? 0) / total * annualRevenue);
    allocated += revenue;
    return { ...row, revenue, revenue_low: null, revenue_high: null, occupancy: null, adr: null, modelled: true };
  });
  return { ...enrichment, seasonality };
}
