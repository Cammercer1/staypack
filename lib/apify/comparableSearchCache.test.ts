import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildComparableSearchCacheKey,
  comparableSearchCacheTtlMs,
  loadComparableSearchThroughCache,
  type ApifyComparableSearchRequest,
  type ComparableSearchCacheStore,
} from "@/lib/apify/comparableSearchCache";
import type { ApifyReaListingRecord } from "@/lib/apify/types";

const request: ApifyComparableSearchRequest = {
  actorId: "actor-1",
  startUrls: ["https://www.realestate.com.au/rent/in-randwick/list-1"],
  maxItems: 50,
  includeSurroundingSuburbs: true,
  datasetItemLimit: 100,
  datasetFields: "listingId,address,price",
};

function memoryStore() {
  const values = new Map<string, ApifyReaListingRecord[]>();
  const store: ComparableSearchCacheStore = {
    async get(cacheKey) {
      return values.get(cacheKey) ?? null;
    },
    async set(cacheKey, _request, records) {
      values.set(cacheKey, records);
    },
  };
  return { store, values };
}

describe("Apify comparable search cache", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses every result-affecting request option in the cache key", () => {
    const base = buildComparableSearchCacheKey(request);

    expect(buildComparableSearchCacheKey({
      ...request,
      includeSurroundingSuburbs: false,
    })).not.toBe(base);
    expect(buildComparableSearchCacheKey({
      ...request,
      datasetItemLimit: 50,
    })).not.toBe(base);
    expect(buildComparableSearchCacheKey({
      ...request,
      startUrls: [...request.startUrls].reverse().concat("https://example.com"),
    })).not.toBe(base);
    expect(buildComparableSearchCacheKey({ ...request })).toBe(base);
  });

  it("uses shorter freshness for rent than sold searches", () => {
    expect(comparableSearchCacheTtlMs(request.startUrls)).toBe(
      72 * 60 * 60 * 1000,
    );
    expect(comparableSearchCacheTtlMs([
      "https://www.realestate.com.au/sold/in-randwick/list-1",
    ])).toBe(720 * 60 * 60 * 1000);
  });

  it("replays the exact cached records without rerunning the loader", async () => {
    const { store } = memoryStore();
    const records = [{ listingId: "listing-1", price: "$900 per week" }];
    const loader = vi.fn().mockResolvedValue(records);

    const first = await loadComparableSearchThroughCache({
      request,
      loader,
      store,
    });
    const second = await loadComparableSearchThroughCache({
      request,
      loader,
      store,
    });

    expect(first).toEqual(records);
    expect(second).toEqual(records);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not cache an empty actor response", async () => {
    const { store, values } = memoryStore();
    const loader = vi.fn().mockResolvedValue([]);

    await loadComparableSearchThroughCache({ request, loader, store });
    await loadComparableSearchThroughCache({ request, loader, store });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(values.size).toBe(0);
  });

  it("fails open when cache reads and writes fail", async () => {
    const store: ComparableSearchCacheStore = {
      async get() {
        throw new Error("read failed");
      },
      async set() {
        throw new Error("write failed");
      },
    };
    const records = [{ listingId: "listing-2" }];

    await expect(loadComparableSearchThroughCache({
      request,
      loader: async () => records,
      store,
    })).resolves.toEqual(records);
  });
});
