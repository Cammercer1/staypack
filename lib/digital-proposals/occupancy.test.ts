import { expect, it } from "vitest";
import type { StrMarketOccupancy } from "@/lib/types";
import { occupancyProfileFromReport } from "./occupancy";
import { proposalDataSchema, proposalFromReport } from "./data";
import { createProposalFixture } from "./fixtures";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";

const history = (): StrMarketOccupancy => ({ status: "available", market: null, label: "Sydney", filters: {},
  benchmark_scope: "all_property_types", fetched_at: "2026-10-12T00:00:00Z", request_key: "private-key", cost_cents: 2, sample_count: null, warnings: [], raw: { private: true },
  months: [{ month: "2026-09", average: 70, p25: 40, p50: 60, p75: 80, p90: 90 }, { month: "2026-07", average: 0, p25: 0, p50: 0, p75: 0, p90: 0 }],
});
it("keeps history chronological, bounds the year and preserves gaps and genuine zero occupancy", () => {
  const profile = occupancyProfileFromReport(history())!;
  expect(profile.months).toHaveLength(12);
  expect(profile.months[0]).toEqual({ month: "2025-10", average: null });
  expect(profile.months.slice(-3)).toEqual([{ month: "2026-07", average: 0 }, { month: "2026-08", average: null }, { month: "2026-09", average: 70 }]);
  expect(profile.allPropertyTypes).toBe(true);
  expect(JSON.stringify(profile)).not.toContain("private");
});
it("rejects ambiguous or invalid history instead of filling it from modelled seasonality", () => {
  expect(occupancyProfileFromReport(undefined)).toBeNull();
  expect(occupancyProfileFromReport({ ...history(), status: "unavailable" })).toBeNull();
  expect(occupancyProfileFromReport({ ...history(), months: [] })).toBeNull();
  for (const average of [-1, 101, NaN, Infinity]) expect(occupancyProfileFromReport({ ...history(), months: [{ ...history().months[0], average }] })).toBeNull();
  expect(occupancyProfileFromReport({ ...history(), months: [history().months[0], history().months[0]] })).toBeNull();
  expect(occupancyProfileFromReport({ ...history(), months: [{ ...history().months[0], month: "2026-13" }] })).toBeNull();
});
it("freezes only public occupancy data and leaves legacy snapshots compatible", () => {
  const report = getStrPlaygroundReport();
  report.str_enrichment = { tier: "full", comp_count: 0, radius_m: null, revenue_range: null, comps: [], seasonality: [], market_occupancy: history() };
  const data = proposalFromReport(report);
  report.str_enrichment.market_occupancy!.months[0].average = 10;
  expect(data.occupancy!.months.at(-1)!.average).toBe(70);
  expect(data.seasonality).toBeNull(); // Occupancy is independent of revenue seasonality.
  expect(proposalDataSchema.parse({ ...createProposalFixture(), occupancy: undefined }).occupancy).toBeNull();
});
