import { afterEach, expect, it, vi } from "vitest";
import { hostingDatabaseFetch } from "./databaseFetch";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("caches immutable snapshots but checks access again after warming the cache", async () => {
  vi.stubEnv("CLOUDFLARE_APP", "1");
  const upstream = vi.fn(async () => Response.json({ allowed: true }));
  vi.stubGlobal("fetch", upstream);
  const content = { cache: "force-cache" as const, next: { revalidate: 86400 } };
  await hostingDatabaseFetch("https://database.example/snapshot-1", content);
  await hostingDatabaseFetch("https://database.example/snapshot-1", content);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0]).toEqual(["https://database.example/snapshot-1", expect.objectContaining({ cache: "no-store" })]);
  upstream.mockImplementation(async () => Response.json({ allowed: false }));
  const access = await hostingDatabaseFetch("https://database.example/access-1", { cache: "no-store" });
  expect(await access.json()).toEqual({ allowed: false });
  expect(upstream).toHaveBeenCalledTimes(2);
});
