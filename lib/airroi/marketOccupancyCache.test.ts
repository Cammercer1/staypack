import { beforeEach, describe, expect, it, vi } from "vitest";
const { cached } = vi.hoisted(() => ({ cached: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: cached }));
import { withAirroiMarketCache } from "./marketOccupancyCache";

beforeEach(() => vi.resetAllMocks());
describe("market cache outside Next", () => {
  it("loads history once when a standalone generator has no incremental cache", async () => {
    cached.mockReturnValue(async () => { throw new Error("Invariant: incrementalCache missing in unstable_cache callback"); });
    const load = vi.fn().mockResolvedValue({ months: 12 });
    const requests = await Promise.all([withAirroiMarketCache("cli", load, new Date("2026-10-13")), withAirroiMarketCache("cli", load, new Date("2026-10-13"))]);
    expect(requests).toEqual([{ months: 12 }, { months: 12 }]);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("does not retry a paid request when the provider or cache fails", async () => {
    const load = vi.fn().mockRejectedValue(new Error("Provider timeout"));
    cached.mockImplementation(callback => callback);
    await expect(withAirroiMarketCache("failure", load, new Date())).rejects.toThrow("Provider timeout");
    expect(load).toHaveBeenCalledTimes(1);
    cached.mockReturnValue(async () => { throw new Error("Cache write failed"); });
    await expect(withAirroiMarketCache("cache-error", load, new Date())).rejects.toThrow("Cache write failed");
    expect(load).toHaveBeenCalledTimes(1);
  });
});
