import { expect, it, vi } from "vitest";
import { branchPreviewHandler } from "./branchPreview";

const env = { BRANCH_PREVIEW_ACCESS_KEY: "test-only-private-key", NEXT_PUBLIC_SUPABASE_URL: "https://preview.invalid", NEXT_PUBLIC_REPORTS_URL: "https://preview.example", RELEASE_SHA: "a".repeat(40) };
const request = (path: string, authorized = true, method = "GET") => new Request(`https://preview.example${path}`, { method, headers: authorized ? { Authorization: `Basic ${btoa("preview:" + env.BRANCH_PREVIEW_ACCESS_KEY)}` } : {} });

it.each(["/", "/dev/branch-preview", "/_next/static/app.js", "/marketing/photo.webp", "/__preview/health"])("protects every request including assets: %s", async path => {
  const app = vi.fn();
  const result = await branchPreviewHandler(app)(request(path, false), env);
  expect(result.status).toBe(401);
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(app).not.toHaveBeenCalled();
});
it.each(["/api/str/estimate", "/api/delivery/cron", "/api/billing/webhook", "/dashboard", "/proposal/secret", "/proposal/print/secret", "/api/anything.js"])("never executes live routes: %s", async path => {
  const app = vi.fn();
  expect((await branchPreviewHandler(app)(request(path), env)).status).toBe(404);
  expect(app).not.toHaveBeenCalled();
});
it.each(["SUPABASE_SERVICE_ROLE_KEY", "PUBLIC_REPORTS", "APPRAISAL_JOBS", "R2_SECRET_ACCESS_KEY", "OPENAI_API_KEY"])("fails closed if a live binding is added: %s", async name => {
  const app = vi.fn();
  expect((await branchPreviewHandler(app)(request("/"), { ...env, [name]: "accidental-binding" })).status).toBe(503);
  expect(app).not.toHaveBeenCalled();
});
it("rejects writes and a production database URL", async () => {
  const app = vi.fn();
  expect((await branchPreviewHandler(app)(request("/dev/branch-preview", true, "POST"), env)).status).toBe(405);
  expect((await branchPreviewHandler(app)(request("/"), { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co" })).status).toBe(503);
  expect(app).not.toHaveBeenCalled();
});
it("allows the sandbox with private headers and blocks external API requests in the browser", async () => {
  const app = vi.fn(async () => new Response("fixture"));
  const result = await branchPreviewHandler(app)(request("/dev/branch-preview"), env);
  expect(await result.text()).toBe("fixture");
  expect(result.headers.get("x-staypack-revision")).toBe(env.RELEASE_SHA);
  expect(result.headers.get("content-security-policy")).toContain("connect-src 'self'");
  expect(result.headers.get("cache-control")).toContain("no-store");
});
it("serves built assets only after authentication", async () => {
  const app = vi.fn();
  const assets = { fetch: vi.fn(async () => new Response("export default {}")) };
  const handler = branchPreviewHandler(app);
  expect((await handler(request("/_next/static/app.js", false), { ...env, ASSETS: assets })).status).toBe(401);
  expect(assets.fetch).not.toHaveBeenCalled();
  const result = await handler(request("/_next/static/app.js"), { ...env, ASSETS: assets });
  expect(result.status).toBe(200);
  expect(await result.text()).toBe("export default {}");
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(app).not.toHaveBeenCalled();
});
