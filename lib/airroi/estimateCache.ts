import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const AIRROI_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WAIT_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 750;
const DATABASE_TIMEOUT_MS = 5_000;

type CalculatorRequest = {
  latitude: number; longitude: number; bedrooms: number; bathrooms: number;
  accommodates: number; radiusM: number; currency: "AUD" | "USD";
};

/** Only effective provider inputs belong here, never contacts or agency adjustments. */
export function airroiCalculatorCacheKey(input: CalculatorRequest) {
  return createHash("sha256").update(JSON.stringify([
    "airroi-calculator-v1", input.latitude, input.longitude, input.bedrooms,
    input.bathrooms, input.accommodates, input.radiusM / 1609.344,
    "entire_home", "native", input.currency,
  ])).digest("hex");
}

const timestampsSchema = z.object({ fetched_at: z.string(), expires_at: z.string() });
const claimSchema = z.discriminatedUnion("status", [
  timestampsSchema.extend({ status: z.literal("hit"), response: z.unknown(), request_id: z.string().nullable() }),
  z.object({ status: z.literal("claimed") }),
  z.object({ status: z.literal("pending"), retry_at: z.string() }),
  z.object({ status: z.literal("cooldown"), retry_at: z.string() }),
]);
export type AirroiCacheClaim = z.infer<typeof claimSchema>;
export type AirroiCachePayload = { response: unknown; request_id: string | null };
type CacheTimestamps = z.infer<typeof timestampsSchema>;
export type AirroiCacheResult = AirroiCachePayload & CacheTimestamps & { cache_status: "hit" | "miss" };

export interface AirroiCacheStore {
  claim(key: string, owner: string): Promise<AirroiCacheClaim>;
  complete(key: string, owner: string, payload: AirroiCachePayload): Promise<CacheTimestamps>;
  fail(key: string, owner: string): Promise<void>;
}

export function createAirroiCacheStore(): AirroiCacheStore {
  const admin = createAdminClient();
  return {
    async claim(key, owner) {
      const { data, error } = await admin.rpc("claim_airroi_calculator_cache", { p_request_key: key, p_lease_owner: owner })
        .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
      // Never bypass a failed reservation with an uncoordinated paid request.
      if (error) throw new Error("The estimate cache is temporarily unavailable. Please try again shortly.");
      return claimSchema.parse(data);
    },
    async complete(key, owner, payload) {
      // The completion RPC is idempotent for this owner. Retrying persistence
      // cannot repeat the paid provider call or extend the original expiry.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data, error } = await admin.rpc("complete_airroi_calculator_cache", {
            p_request_key: key, p_lease_owner: owner, p_response: payload.response, p_request_id: payload.request_id,
          }).abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
          if (!error) return timestampsSchema.parse(data);
          if (error.code === "PT409") break;
        } catch {
          // A lost response may follow a committed transaction; replay once.
        }
      }
      throw new Error("The estimate could not be saved. Please try again shortly.");
    },
    async fail(key, owner) {
      const { error } = await admin.rpc("fail_airroi_calculator_cache", { p_request_key: key, p_lease_owner: owner })
        .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
      if (error) throw new Error("Could not release the estimate reservation");
    },
  };
}

function assertFresh(timestamps: CacheTimestamps) {
  const fetched = Date.parse(timestamps.fetched_at);
  const expires = Date.parse(timestamps.expires_at);
  const now = Date.now();
  if (!Number.isFinite(fetched) || !Number.isFinite(expires) || fetched > now + 60_000 ||
    expires <= now || expires <= fetched || expires - fetched > AIRROI_CACHE_TTL_MS + 1) {
    throw new Error("The saved estimate has expired. Please request a new estimate.");
  }
}

/** Durable leases coordinate Netlify workers as well as interactive report builds. */
export async function cachedAirroiCalculator(
  key: string,
  fetchFresh: () => Promise<AirroiCachePayload>,
  store: AirroiCacheStore = createAirroiCacheStore(),
): Promise<AirroiCacheResult> {
  const owner = randomUUID();
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (true) {
    const reservation = await store.claim(key, owner);
    if (reservation.status === "hit") {
      assertFresh(reservation);
      return { response: reservation.response, request_id: reservation.request_id,
        fetched_at: reservation.fetched_at, expires_at: reservation.expires_at, cache_status: "hit" };
    }
    if (reservation.status === "cooldown") {
      throw new Error("An estimate was recently attempted for this property. Please try again shortly.");
    }
    if (reservation.status === "claimed") {
      try {
        const payload = await fetchFresh();
        const timestamps = await store.complete(key, owner, payload);
        assertFresh(timestamps);
        return { ...payload, ...timestamps, cache_status: "miss" };
      } catch (error) {
        // A timeout can mean the provider processed the request. Do not retry it here.
        try { await store.fail(key, owner); } catch { /* The bounded lease remains in place. */ }
        throw error;
      }
    }
    if (Date.now() >= deadline) {
      throw new Error("An estimate is already being prepared for this property. Please try again shortly.");
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
