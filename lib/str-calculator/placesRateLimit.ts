import "server-only";
import { createHash } from "node:crypto";
import { CalculatorError } from "./service";

// A bounded per-process burst guard; Google Cloud quotas remain the global cost cap.
// Unlike lead limits, suggestion requests contain no lead data and are not persisted.
const buckets = new Map<string, { count: number; expires: number }>();
export function limitCalculatorPlaces(token: string, client: string) {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
  const visitor = createHash("sha256").update(`${token}:${client}`).digest("hex");
  const limits = [
    { key: visitor, max: 60, duration: 60_000 },
    { key: `widget:${token}`, max: 1000, duration: 3_600_000 },
  ];
  const missing = limits.filter(({ key }) => !buckets.has(key)).length;
  if (buckets.size + missing > 4096 || limits.some(({ key, max }) => (buckets.get(key)?.count ?? 0) >= max)) {
    throw new CalculatorError("Suggestions are temporarily limited. You can still enter the full address.", 429);
  }
  for (const { key, duration } of limits) {
    const bucket = buckets.get(key) ?? { count: 0, expires: now + duration };
    bucket.count += 1;
    buckets.set(key, bucket);
  }
}
