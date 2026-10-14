// A Node builtin keeps this credential-bearing client out of browser bundles
// while also allowing it to load in standalone background workers.
import { env } from "node:process";
import { z } from "zod";
const HOST = "real-time-real-estate-data2.p.rapidapi.com";
const envelope = z.object({ status: z.literal("OK"), data: z.unknown() });
export async function fetchUsPropertyData(endpoint: "property-details-address" | "property-details" | "search" | "search-coordinates", params: Record<string, string>, options: { timeoutMs?: number } = {}) {
  const key = env.RAPIDAPI_US_PROPERTY_KEY?.trim() || env.RAPIDAPI_REA_KEY?.trim() || env.RAPIDAPI_KEY?.trim();
  if (!key) throw new Error("US property data is not configured. You can enter the details manually.");
  const response = await fetch(`https://${HOST}/zillow/${endpoint}?${new URLSearchParams(params)}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST }, cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? 25000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "US property lookup has reached its request limit. Try later or enter the details manually." : "US property data is unavailable. Try again or enter the details manually.");
  const result = envelope.safeParse(await response.json());
  if (!result.success) throw new Error("No usable US property data was returned. Enter the details manually.");
  return result.data.data;
}
