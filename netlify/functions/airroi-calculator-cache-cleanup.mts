/** Only deletes expired rows in the dedicated provider cache. Never calls AirROI. */
export default async function handler() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Calculator cache cleanup is not configured");

  const deadline = Date.now() + 20_000;
  const batchSize = 1_000;
  for (let batch = 0; batch < 20; batch++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Calculator cache cleanup reached its time limit");
    const response = await fetch(new URL("/rest/v1/rpc/purge_airroi_calculator_cache", url), {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_limit: batchSize }),
      signal: AbortSignal.timeout(Math.min(8_000, remaining)),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Calculator cache cleanup returned ${response.status}`);
    const deleted: unknown = await response.json();
    if (typeof deleted !== "number" || !Number.isInteger(deleted) || deleted < 0 || deleted > batchSize) {
      throw new Error("Calculator cache cleanup returned an invalid count");
    }
    if (deleted < batchSize) return new Response(null, { status: 204 });
  }
  throw new Error("Calculator cache cleanup reached its batch limit; inspect expired cache rows");
}

// Expiry is enforced synchronously by the claim RPC; this removes expired bytes
// even when a property is never requested again or cache reads are disabled.
export const config = { schedule: "*/5 * * * *" };
