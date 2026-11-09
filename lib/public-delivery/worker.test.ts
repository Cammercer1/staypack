import { expect, it, vi } from "vitest";
import { workerDatabaseFetch, workerRouter } from "./worker";

it("strips Next cache hints and bypasses Cloudflare caching for database requests", async () => {
  const upstream = vi.fn(async () => new Response("[]"));
  await workerDatabaseFetch(upstream)("https://database.example.com/reader", { cache: "force-cache", next: { revalidate: 86400 }, headers: { authorization: "private" } });
  expect(upstream.mock.calls[0]).toEqual(["https://database.example.com/reader", { cache: "no-store", headers: { authorization: "private" }, signal: expect.any(AbortSignal) }]);
});

it("always checks report access, including a revoked report after a successful response", async () => {
  let revoked = false;
  const reader = vi.fn(async () => new Response(revoked ? "Unavailable" : "Report", { status: revoked ? 404 : 200, headers: { "Cache-Control": "private, no-store" } }));
  const assets = { ASSETS: { fetch: vi.fn() } }, origin = vi.fn();
  const handler = workerRouter(reader, origin);
  for (const path of ["/examples/company/property", "/example/token", "/proposal/token", "/proposal/token?version=id"]) {
    revoked = false;
    expect((await handler(new Request(`https://staypack.app${path}`), assets)).status).toBe(200);
    revoked = true;
    const response = await handler(new Request(`https://staypack.app${path}`), assets);
    expect(response.status).toBe(404); expect(response.headers.get("Cache-Control")).toContain("no-store");
  }
  expect(reader).toHaveBeenCalledTimes(8);
  expect(assets.ASSETS.fetch).not.toHaveBeenCalled(); expect(origin).not.toHaveBeenCalled();
});

it("preserves private print authorization at the origin without preview recursion", async () => {
  const reader = vi.fn(), assets = { ASSETS: { fetch: vi.fn() } };
  const response = new Response("Forbidden", { status: 403 });
  const origin = vi.fn(async () => response), handler = workerRouter(reader, origin);
  const request = new Request("https://staypack.app/proposal/print/id?token=private");
  expect(await handler(request, assets)).toBe(response); expect(origin).toHaveBeenCalledWith(request);
  expect((await handler(new Request("https://preview.workers.dev/proposal/print/id"), assets)).status).toBe(404);
  expect(origin).toHaveBeenCalledTimes(1); expect(reader).not.toHaveBeenCalled();
});

it("serves static assets from the asset binding", async () => {
  const reader = vi.fn(), response = new Response("body{}"), assets = { ASSETS: { fetch: vi.fn(async () => response) } };
  const request = new Request("https://staypack.app/_report-viewer/base.css");
  expect(await workerRouter(reader)(request, assets)).toBe(response);
  expect(assets.ASSETS.fetch).toHaveBeenCalledWith(request); expect(reader).not.toHaveBeenCalled();
});
