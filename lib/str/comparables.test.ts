import { expect, it } from "vitest";
import { rankStrComps, selectStrComps, alignStrSeasonality } from "./comparables";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { ensureStrEnrichmentFeaturedComps } from "@/lib/airbtics/enrich";

it("ranks same-size apartments ahead of higher earning houses", () => {
  const { report } = createLintRegressionFixtures();
  const base = report.str_enrichment_json!.comps[0];
  const ranked = rankStrComps([
    { ...base, listing_id: "house", bedrooms: 3, property_type: "Entire home", annual_revenue: 200000 },
    { ...base, listing_id: "unit", bedrooms: 3, property_type: "Entire rental unit", annual_revenue: 60000 },
  ], { bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: "Apartment" });
  expect(ranked[0].listing_id).toBe("unit");
  expect(ranked[1].match_notes).toContain("Different or unknown property type");
});
it("preserves selection order, prevents foreign IDs, and bypasses legacy reselection", () => {
  const { report } = createLintRegressionFixtures();
  const enrichment = report.str_enrichment_json!;
  const ids = enrichment.comps.slice(0, 3).reverse().map((comp) => comp.listing_id);
  const selected = selectStrComps(enrichment, ids);
  expect(selected.comps.map((c) => c.listing_id)).toEqual(ids);
  expect(ensureStrEnrichmentFeaturedComps(selected, report.raw_airbtics_json)).toBe(selected);
  expect(() => selectStrComps(enrichment, ["foreign"])).toThrow();
  expect(() => selectStrComps(enrichment, [ids[0], ids[0]])).toThrow();
  expect(() => selectStrComps(enrichment, [])).toThrow();
});
it("prefers established booking activity over a near match with little annual activity", () => {
  const base = createLintRegressionFixtures().report.str_enrichment_json!.comps[0];
  const ranked = rankStrComps([
    { ...base, listing_id: "limited", bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: "Entire rental unit", occupancy_rate: 15, distance_m: 100 },
    { ...base, listing_id: "active", bedrooms: 3, bathrooms: 2, accommodates: 7, property_type: "Entire rental unit", occupancy_rate: 65, distance_m: 1500 },
  ], { bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: "Apartment" });
  expect(ranked[0].listing_id).toBe("active");
  expect(ranked[1].match_notes).toContain("Limited booked activity");
});
it("modelled seasonal allocations follow the reviewed annual figure and sum exactly", () => {
  const { report } = createLintRegressionFixtures();
  const enrichment = { ...report.str_enrichment_json!, seasonality_basis: "modelled" as const, seasonality: Array.from({ length: 12 }, (_, index) => ({ month: String(index + 1), revenue: 5000, revenue_low: null, revenue_high: null, occupancy: null, adr: null })) };
  const aligned = alignStrSeasonality(enrichment, 87654);
  expect(aligned.seasonality.reduce((sum, row) => sum + row.revenue!, 0)).toBe(87654);
  expect(aligned.seasonality.every((r) => r.occupancy === null && r.adr === null && r.revenue_low === null)).toBe(true);
  expect(alignStrSeasonality(report.str_enrichment_json!, 87654)).toBe(report.str_enrichment_json);
});
