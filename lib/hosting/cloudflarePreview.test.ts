import { beforeEach, expect, it, vi } from "vitest";

const { render } = vi.hoisted(() => ({ render: vi.fn(async () => new Response("app")) }));
vi.mock("vinext/server/fetch-handler", () => ({ default: { fetch: render } }));
import worker from "../../cloudflare/app-preview-entry";

const reports = vi.fn(async () => new Response("report", { headers: { "Cache-Control": "private, no-store" } }));
const env = { PREVIEW_ACCESS_KEY: "test-preview-key", PREVIEW_AGENCY_ID: "test-agency", PUBLIC_REPORTS: { fetch: reports } };
const context = { waitUntil: vi.fn() };
const request = (path: string, headers: HeadersInit = { "x-staypack-preview-key": env.PREVIEW_ACCESS_KEY }) => new Request(`https://preview.example${path}`, { headers });
beforeEach(() => vi.clearAllMocks());

it("denies access without the private preview gate, including when unconfigured", async () => {
  expect((await worker.fetch(request("/dashboard", {}), env, context)).status).toBe(404);
  expect((await worker.fetch(request("/dashboard"), { ...env, PREVIEW_ACCESS_KEY: "" }, context)).status).toBe(404);
  expect(render).not.toHaveBeenCalled();
});

it("accepts the private cookie while preserving app authorization and disabling deliveries", async () => {
  expect((await worker.fetch(request("/dashboard", { cookie: `__Host-staypack-preview=${env.PREVIEW_ACCESS_KEY}` }), env, context)).status).toBe(200);
  expect(render).toHaveBeenCalledOnce();
  expect((await worker.fetch(request("/api/delivery/cron"), env, context)).status).toBe(409);
  expect((await worker.fetch(request("/api/billing/usage-sync"), env, context)).status).toBe(409);
  expect(render).toHaveBeenCalledOnce();
});

it("uses the live report access checker and keeps private print routes in the app", async () => {
  const response = await worker.fetch(request("/proposal/test-token"), env, context);
  expect(reports).toHaveBeenCalledOnce();
  expect(response.headers.get("cache-control")).toContain("no-store");
  await worker.fetch(request("/_report-viewer/viewer.js"), env, context);
  expect(reports).toHaveBeenCalledTimes(2);
  await worker.fetch(request("/proposal/print/test-version"), env, context);
  expect(render).toHaveBeenCalledOnce();
});
