import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), signals: [] as AbortSignal[] }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: (...args: unknown[]) => ({ abortSignal: (signal: AbortSignal) => { mocks.signals.push(signal); return mocks.rpc(...args); } }),
}) }));
import { AIRROI_CACHE_TTL_MS, airroiCalculatorCacheKey, cachedAirroiCalculator, createAirroiCacheStore,
  type AirroiCacheClaim, type AirroiCacheStore } from "./estimateCache";

const input = { latitude: -33.9, longitude: 151.2, bedrooms: 3, bathrooms: 1.5, accommodates: 6, radiusM: 2000, currency: "AUD" as const };
const payload = { response: { revenue: 62000 }, request_id: "original" };
const timestamps = () => ({ fetched_at: new Date(Date.now()).toISOString(), expires_at: new Date(Date.now() + AIRROI_CACHE_TTL_MS).toISOString() });
function fakeStore(): AirroiCacheStore & { claim: ReturnType<typeof vi.fn>; complete: ReturnType<typeof vi.fn>; fail: ReturnType<typeof vi.fn> } {
  let state: AirroiCacheClaim = { status: "claimed" };
  return {
    claim: vi.fn(async () => {
      const result = state;
      if (state.status === "claimed") state = { status: "pending", retry_at: new Date(Date.now() + 60_000).toISOString() };
      return result;
    }),
    complete: vi.fn(async (_key, _owner, value) => {
      const dates = timestamps();
      state = { status: "hit", ...dates, ...value };
      return dates;
    }),
    fail: vi.fn(async () => { state = { status: "cooldown", retry_at: new Date(Date.now() + 30_000).toISOString() }; }),
  };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T00:00:00Z")); mocks.rpc.mockReset(); mocks.signals.length = 0; });
afterEach(() => { vi.useRealTimers(); });

describe("shared calculator cache", () => {
  it("keys all effective inputs, without agency data or local comparable ranking", () => {
    const key = airroiCalculatorCacheKey(input);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(airroiCalculatorCacheKey({ ...input, ...{ property_type: "House", suburb: "Sydney", email: "private@example.com" } })).toBe(key);
    for (const change of [{ latitude: -33.90001 }, { longitude: 151.20001 }, { bedrooms: 4 }, { bathrooms: 2 }, { accommodates: 8 }, { radiusM: 3000 }, { currency: "USD" as const }]) {
      expect(airroiCalculatorCacheKey({ ...input, ...change })).not.toBe(key);
    }
  });
  it("keeps the original fetch date and 30-day expiry when reused", async () => {
    const store = fakeStore(); const fetch = vi.fn().mockResolvedValue(payload);
    const first = await cachedAirroiCalculator("key", fetch, store);
    vi.advanceTimersByTime(29 * 86400000);
    const second = await cachedAirroiCalculator("key", fetch, store);
    expect(first.cache_status).toBe("miss"); expect(second.cache_status).toBe("hit");
    expect(second.fetched_at).toBe(first.fetched_at); expect(second.expires_at).toBe(first.expires_at);
    expect(fetch).toHaveBeenCalledOnce(); expect(store.complete).toHaveBeenCalledOnce();
  });
  it("coalesces separate worker requests behind one durable reservation", async () => {
    const store = fakeStore();
    let release!: (value: typeof payload) => void;
    const fetch = vi.fn(() => new Promise<typeof payload>(resolve => { release = resolve; }));
    const first = cachedAirroiCalculator("key", fetch, store);
    await vi.advanceTimersByTimeAsync(0);
    const second = cachedAirroiCalculator("key", fetch, store);
    await vi.advanceTimersByTimeAsync(0);
    release(payload);
    await vi.advanceTimersByTimeAsync(750);
    const results = await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledOnce(); expect(results.map(result => result.cache_status)).toEqual(["miss", "hit"]);
    expect(store.claim.mock.calls[0][1]).not.toBe(store.claim.mock.calls[1][1]);
  });
  it("never reuses data at or beyond its 30-day boundary", async () => {
    const store = fakeStore(); const fetch = vi.fn().mockResolvedValue(payload);
    await cachedAirroiCalculator("key", fetch, store);
    vi.advanceTimersByTime(AIRROI_CACHE_TTL_MS);
    // SQL normally claims a new lease here. Even an invalid hit is rejected.
    await expect(cachedAirroiCalculator("key", fetch, store)).rejects.toThrow(/expired/);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not retry a timed-out provider or let waiting visitors immediately retry it", async () => {
    const store = fakeStore(); const fetch = vi.fn().mockRejectedValue(new Error("provider timeout"));
    await expect(cachedAirroiCalculator("key", fetch, store)).rejects.toThrow("provider timeout");
    await expect(cachedAirroiCalculator("key", fetch, store)).rejects.toThrow(/recently attempted/);
    expect(fetch).toHaveBeenCalledOnce(); expect(store.complete).not.toHaveBeenCalled(); expect(store.fail).toHaveBeenCalledOnce();
  });
  it("bounds waiting without starting a second paid call", async () => {
    const store = fakeStore();
    store.claim.mockResolvedValue({ status: "pending", retry_at: new Date(Date.now() + 60_000).toISOString() });
    const fetch = vi.fn();
    const result = expect(cachedAirroiCalculator("key", fetch, store)).rejects.toThrow(/already being prepared/);
    await vi.advanceTimersByTimeAsync(26_000); await result;
    expect(fetch).not.toHaveBeenCalled(); expect(store.fail).not.toHaveBeenCalled();
  });
  it("fails closed when the cache database is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "connection_error" } });
    const fetch = vi.fn();
    await expect(cachedAirroiCalculator("key", fetch)).rejects.toThrow(/temporarily unavailable/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retries only idempotent persistence after an interrupted database response", async () => {
    const dates = timestamps();
    mocks.rpc.mockResolvedValueOnce({ data: { status: "claimed" }, error: null })
      .mockRejectedValueOnce(new Error("lost database response"))
      .mockResolvedValueOnce({ data: { status: "completed", ...dates }, error: null });
    const fetch = vi.fn().mockResolvedValue(payload);
    expect(await cachedAirroiCalculator("key", fetch)).toMatchObject({ ...dates, cache_status: "miss" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["claim_airroi_calculator_cache", "complete_airroi_calculator_cache", "complete_airroi_calculator_cache"]);
    expect(mocks.rpc.mock.calls[1][1]).toEqual(mocks.rpc.mock.calls[2][1]);
  });
  it("cannot complete after another worker took over the lease", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "PT409" } });
    await expect(createAirroiCacheStore().complete("key", "owner", payload)).rejects.toThrow(/could not be saved/);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("bounds database requests as well as the provider request", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    mocks.rpc.mockResolvedValueOnce({ data: { status: "claimed" }, error: null })
      .mockResolvedValueOnce({ data: timestamps(), error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    await cachedAirroiCalculator("key", vi.fn().mockResolvedValue(payload));
    await createAirroiCacheStore().fail("key", "owner");
    expect(mocks.signals).toHaveLength(3);
    expect(timeout.mock.calls).toEqual([[5000], [5000], [5000]]);
    timeout.mockRestore();
  });
});
