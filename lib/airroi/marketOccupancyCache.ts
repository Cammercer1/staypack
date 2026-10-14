import { unstable_cache } from "next/cache";

const WEEK_MS = 7 * 86400000;
const pending = new Map<string, Promise<unknown>>();

/** Shared provider data only: never put a report, agency, API key or user input in
 * the cached value. The app still uses Next's pre-Cache-Components data cache.
 * Fixed windows avoid stale-while-revalidate making an unaccounted paid call.
 * A new calendar month also starts a new window for completed-month history.
 */
export async function withAirroiMarketCache<T>(key: string, load: () => Promise<T>, now: Date): Promise<T> {
  const parts = ["airroi-market-v2", key, String(Math.floor(now.getTime() / WEEK_MS)), now.toISOString().slice(0, 7)];
  const pendingKey = JSON.stringify(parts);
  const existing = pending.get(pendingKey);
  if (existing) return existing as Promise<T>;
  let started = false;
  const request = unstable_cache(() => { started = true; return load(); }, parts, { revalidate: false })().catch(error => {
    // Trusted CLI/background generation has no Next incremental cache. Only
    // bypass that missing context before load starts; never retry provider errors.
    if (!started && error instanceof Error && error.message.startsWith("Invariant: incrementalCache missing in unstable_cache")) return load();
    throw error;
  });
  pending.set(pendingKey, request);
  try {
    return await request;
  } finally {
    pending.delete(pendingKey);
  }
}
