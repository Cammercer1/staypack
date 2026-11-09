import { expect, it, vi } from "vitest";
import { snapshotCache } from "./cache";

it("caches only explicit immutable reads, with expiry and no stale fallback", async () => {
  let now = 0;
  const upstream = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ snapshot: true }));
  const fetcher = snapshotCache(upstream, () => now);
  const options = { cache: "force-cache" as const, next: { revalidate: 1 } };
  await fetcher("https://db/content", options); await fetcher("https://db/content", options);
  expect(upstream).toHaveBeenCalledTimes(1);
  await fetcher("https://db/access", { cache: "no-store" }); await fetcher("https://db/access", { cache: "no-store" });
  expect(upstream).toHaveBeenCalledTimes(3);
  now = 1001; upstream.mockResolvedValue(new Response(null, { status: 503 }));
  expect((await fetcher("https://db/content", options)).status).toBe(503);
  expect((await fetcher("https://db/content", options)).status).toBe(503);
  expect(upstream).toHaveBeenCalledTimes(5);
});

it("bounds storage and evicts the oldest snapshot without caching an access check", async () => {
  const upstream = vi.fn<typeof fetch>().mockImplementation(async () => new Response('"123456789012345678"'));
  const fetcher = snapshotCache(upstream, () => 0, 40);
  const options = { cache: "force-cache" as const, next: { revalidate: 3600 } };
  for (const key of ["a", "b", "c", "c", "a"]) await fetcher(`https://db/${key}`, options);
  expect(upstream).toHaveBeenCalledTimes(4);
});
