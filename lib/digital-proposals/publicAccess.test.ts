import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient: createClient }));
import { middleware } from "../../middleware";
beforeEach(() => vi.resetAllMocks());

it("does not refresh account sessions for bearer-link proposal pages and their APIs", async () => {
  for (const path of ["/", "/login", "/signup", "/api/agents", "/proposal/abc", "/proposal/print/abc", "/api/proposals/abc/events", "/api/proposals/abc/pdf"]) {
    const response = await middleware(new NextRequest(`https://staypack.app${path}`));
    expect(response.status).toBe(200);
  }
  expect(createClient).not.toHaveBeenCalled();
});

it("preserves refreshed auth cookies without querying membership in middleware", async () => {
  createClient.mockImplementation((_url, _key, options) => ({ auth: { getClaims: async () => {
    options.cookies.setAll([{ name: "session", value: "refreshed", options: { httpOnly: true } }]);
    return { data: { claims: { sub: "user" } } };
  } } }));
  const response = await middleware(new NextRequest("https://staypack.app/dashboard"));
  expect(response.status).toBe(200);
  expect(response.cookies.get("session")?.value).toBe("refreshed");
});
it("still redirects legacy proposal hosts to the canonical host", async () => {
  const response = await middleware(new NextRequest("https://staypack.netlify.app/proposal/abc", { headers: { host: "staypack.netlify.app" } }));
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe("https://staypack.app/proposal/abc");
});
it("still authenticates and protects the appraisal workspace", async () => {
  createClient.mockReturnValue({ auth: { getClaims: async () => ({ data: null }) } });
  const response = await middleware(new NextRequest("https://staypack.app/short-term-rentals"));
  expect(response.headers.get("location")).toContain("/login?redirectTo=");
  expect(createClient).toHaveBeenCalledTimes(1);
});

it.each(["/contacts", "/clients"])("requires authentication for %s", async path => {
  createClient.mockReturnValue({ auth: { getClaims: async () => ({ data: null }) } });
  const response = await middleware(new NextRequest(`https://staypack.app${path}`));
  expect(response.headers.get("location")).toBe(`https://staypack.app/login?redirectTo=${encodeURIComponent(path)}`);
});
