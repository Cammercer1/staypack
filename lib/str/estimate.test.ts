import { afterEach, expect, it, vi } from "vitest";
import { fetchStrEstimate } from "./estimate";
import { fetchAirroiEstimate, normaliseAirroiResponse } from "@/lib/airroi/client";
import { fetchAirroiMarketOccupancy } from "@/lib/airroi/marketOccupancy";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
vi.mock("@/lib/airroi/client", async (original) => ({ ...await original<typeof import("@/lib/airroi/client")>(), fetchAirroiEstimate: vi.fn() }));
vi.mock("@/lib/airroi/marketOccupancy", () => ({ fetchAirroiMarketOccupancy: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("uses the AirROI headline without model calls or sparse-comp retries", async () => {
  const f = createLintRegressionFixtures();
  const input = { latitude: -33.9, longitude: 151.2, bedrooms: 3, bathrooms: 2, accommodates: 6 };
  const result = normaliseAirroiResponse({ currency: "AUD", revenue: 63638.64, occupancy: .5645543, average_daily_rate: 318.6921,
    percentiles: { revenue: { p25: 36000, p50: 60000, p75: 82000, p90: 108000 }, occupancy: { p25: .39, p50: .58, p75: .73, p90: .82 }, average_daily_rate: { p25: 225, p50: 293, p75: 380, p90: 492 } },
    monthly_revenue_distributions: Array(12).fill(1 / 12), comparable_listings: [],
  }, input);
  vi.mocked(fetchAirroiEstimate).mockResolvedValue(result);
  vi.mocked(fetchAirroiMarketOccupancy).mockResolvedValue({ status: "unavailable", cost_cents: 0 } as Awaited<ReturnType<typeof fetchAirroiMarketOccupancy>>);
  const network = vi.fn(); vi.stubGlobal("fetch", network);
  const saved = await fetchStrEstimate(input, f.listing);
  expect(saved.estimate.annualRevenue).toBe(63639);
  expect(saved.enrichment.positioning).toBeUndefined();
  expect(saved.enrichment.comps).toHaveLength(0);
  expect(saved.enrichment.seasonality.reduce((sum, row) => sum + row.revenue!, 0)).toBe(63639);
  expect(saved.enrichment.cost_cents).toBe(20);
  expect(fetchAirroiEstimate).toHaveBeenCalledTimes(1);
  expect(fetchAirroiMarketOccupancy).toHaveBeenCalledTimes(1);
  expect(network).not.toHaveBeenCalled();
});
