import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const AIRROI_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WAIT_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 750;
const DATABASE_TIMEOUT_MS = 5_000;

const calculatorRequestSchema = z.object({
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  bedrooms: z.number().int().min(0).max(20), bathrooms: z.number().min(0.5).max(20),
  accommodates: z.number().int().min(1).max(30), radiusM: z.number().min(1609.344).max(16093.44),
  currency: z.enum(["AUD", "USD"]),
});
export type CalculatorRequest = z.infer<typeof calculatorRequestSchema>;
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const AIRROI_PROPERTY_TOLERANCE_M = 50;

/** Only effective provider inputs belong here, never contacts or agency adjustments. */
export function airroiCalculatorCacheKey(input: CalculatorRequest) {
  return createHash("sha256").update(JSON.stringify([
    "airroi-calculator-v1", input.latitude, input.longitude, input.bedrooms,
    input.bathrooms, input.accommodates, input.radiusM / 1609.344,
    "entire_home", "native", input.currency,
  ])).digest("hex");
}

export function airroiCalculatorConfigurationKey(input: CalculatorRequest) {
  return createHash("sha256").update(JSON.stringify([
    "airroi-calculator-config-v1", input.bedrooms, input.bathrooms, input.accommodates,
    input.radiusM, "entire_home", "native", input.currency,
  ])).digest("hex");
}

export function airroiPropertyCalculatorCacheKey(input: CalculatorRequest, propertyKey: string) {
  return createHash("sha256").update(JSON.stringify([
    "airroi-property-calculator-v1", hashSchema.parse(propertyKey), airroiCalculatorCacheKey(input),
  ])).digest("hex");
}

function compatibleProviderInput(request: CalculatorRequest, original: CalculatorRequest) {
  if (airroiCalculatorConfigurationKey(request) !== airroiCalculatorConfigurationKey(original)) return false;
  const rad = (value: number) => value * Math.PI / 180;
  const a = Math.sin(rad(request.latitude - original.latitude) / 2) ** 2
    + Math.cos(rad(request.latitude)) * Math.cos(rad(original.latitude))
    * Math.sin(rad(request.longitude - original.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) <= AIRROI_PROPERTY_TOLERANCE_M;
}

const timestampsSchema = z.object({ fetched_at: z.string(), expires_at: z.string() });
const resolvedRequest = { request_key: hashSchema.optional(), provider_input: calculatorRequestSchema.optional() };
const claimSchema = z.discriminatedUnion("status", [
  timestampsSchema.extend({ status: z.literal("hit"), response: z.unknown(), request_id: z.string().nullable(), ...resolvedRequest }),
  z.object({ status: z.literal("claimed"), ...resolvedRequest }),
  z.object({ status: z.literal("pending"), retry_at: z.string(), ...resolvedRequest }),
  z.object({ status: z.literal("cooldown"), retry_at: z.string(), ...resolvedRequest }),
]);
export type AirroiCacheClaim = z.infer<typeof claimSchema>;
export type AirroiCachePayload = { response: unknown; request_id: string | null };
type CacheTimestamps = z.infer<typeof timestampsSchema>;
export type AirroiCacheResult = AirroiCachePayload & CacheTimestamps & {
  cache_status: "hit" | "miss"; request_key: string; provider_input?: CalculatorRequest;
};

export interface AirroiCacheStore {
  claim(key: string, owner: string): Promise<AirroiCacheClaim>;
  complete(key: string, owner: string, payload: AirroiCachePayload): Promise<CacheTimestamps>;
  fail(key: string, owner: string): Promise<void>;
}

export function createAirroiCacheStore(property?: { input: CalculatorRequest; propertyKey: string }): AirroiCacheStore {
  const admin = createAdminClient();
  const input = property ? calculatorRequestSchema.parse(property.input) : null;
  const propertyKey = property ? hashSchema.parse(property.propertyKey) : null;
  return {
    async claim(key, owner) {
      const { data, error } = await (input && propertyKey
        ? admin.rpc("claim_airroi_property_calculator_cache", {
          p_request_key: key, p_legacy_request_key: airroiCalculatorCacheKey(input), p_lease_owner: owner,
          p_property_key: propertyKey, p_configuration_key: airroiCalculatorConfigurationKey(input), p_input: input,
        })
        : admin.rpc("claim_airroi_calculator_cache", { p_request_key: key, p_lease_owner: owner }))
        .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
      // Never bypass a failed reservation with an uncoordinated paid request.
      if (error) throw new Error("The estimate cache is temporarily unavailable. Please try again shortly.");
      const claim = claimSchema.parse(data);
      if (input && (!claim.request_key || !claim.provider_input || !compatibleProviderInput(input, claim.provider_input))) {
        throw new Error("The saved estimate does not match this property's inputs. Please try again.");
      }
      return claim;
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
  fetchFresh: (providerInput?: CalculatorRequest) => Promise<AirroiCachePayload>,
  store: AirroiCacheStore = createAirroiCacheStore(),
): Promise<AirroiCacheResult> {
  const owner = randomUUID();
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (true) {
    const reservation = await store.claim(key, owner);
    const resolved = { request_key: reservation.request_key ?? key, provider_input: reservation.provider_input };
    if (reservation.status === "hit") {
      assertFresh(reservation);
      return { response: reservation.response, request_id: reservation.request_id,
        fetched_at: reservation.fetched_at, expires_at: reservation.expires_at, cache_status: "hit", ...resolved };
    }
    if (reservation.status === "cooldown") {
      throw new Error("An estimate was recently attempted for this property. Please try again shortly.");
    }
    if (reservation.status === "claimed") {
      try {
        const payload = await fetchFresh(resolved.provider_input);
        const timestamps = await store.complete(resolved.request_key, owner, payload);
        assertFresh(timestamps);
        return { ...payload, ...timestamps, cache_status: "miss", ...resolved };
      } catch (error) {
        // A timeout can mean the provider processed the request. Do not retry it here.
        try { await store.fail(resolved.request_key, owner); } catch { /* The bounded lease remains in place. */ }
        throw error;
      }
    }
    if (Date.now() >= deadline) {
      throw new Error("An estimate is already being prepared for this property. Please try again shortly.");
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
