import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
vi.mock("server-only", () => ({}));
import { publicReportHandler } from "./handler";
import { snapshotCache } from "./cache";

const id = "00000000-0000-4000-8000-000000000001", token = "a".repeat(64), slug = "qa-agency/qa-property";
const snapshot = { version: 1, data: createProposalFixture(), draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [] };
const secret = "PRIVATE_REPORT_CONTENT";
snapshot.data.property.address = secret;
const assets = { script: "/_report-viewer/viewer.js", styles: ["/_report-viewer/base.css"] };
let revoked: boolean, outage: boolean, reads: { url: URL; init?: RequestInit }[];
let handler: ReturnType<typeof publicReportHandler>;
beforeEach(() => {
  revoked = false; outage = false; reads = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.com"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "PRIVATE_SERVICE_KEY");
  const upstream: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); reads.push({ url, init });
    if (init?.cache === "no-store") {
      if (outage) return new Response(null, { status: 503 });
      if (revoked) return Response.json([]);
      if (url.pathname.endsWith("prospect_proposals")) return Response.json([{ id, public_slug: slug, published_at: "2026-11-09T00:00:00Z" }]);
      const version = { id, agency_id: id, report_id: id, content_hash: "hash", pdf_status: "ready", pdf_path: "PRIVATE_STORAGE_PATH", report: { agency_id: id, listing: { agency_id: id } } };
      return Response.json(url.pathname.endsWith("digital_proposal_link_versions") ? [{ link: { id }, version }] : [{ id, version }]);
    }
    return Response.json(url.pathname.endsWith("prospect_proposals") ? [{ final_report_json: snapshot }] : [snapshot]);
  };
  handler = publicReportHandler(assets, snapshotCache(upstream));
});
afterEach(() => vi.unstubAllEnvs());
const get = (path: string, rsc = false) => handler(new Request(`https://staypack.app${path}`, { headers: rsc ? { RSC: "1" } : {} }));

it.each([`/examples/${slug}`, `/proposal/${token}`, `/proposal/${token}?version=${id}`])("freshly denies %s after warming the snapshot cache", async path => {
  for (let i = 0; i < 2; i++) {
    const response = await get(path);
    expect(response.status).toBe(200); expect(await response.text()).toContain(secret);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Netlify-CDN-Cache-Control")).toBe("no-store");
  }
  expect(reads.filter(row => row.init?.cache === "force-cache")).toHaveLength(1);
  revoked = true;
  for (const rsc of [false, true]) {
    const response = await get(path, rsc);
    expect(response.status).toBe(404); expect(await response.text()).not.toContain(secret);
  }
  expect(reads.filter(row => row.init?.cache === "no-store")).toHaveLength(4);
  expect(reads.filter(row => row.init?.cache === "force-cache")).toHaveLength(1);
});

it("checks access before legacy token redirects, and never caches the redirect", async () => {
  const response = await get(`/example/${token}`);
  expect(response.status).toBe(307); expect(response.headers.get("Location")).toBe(`/examples/${slug}`);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  revoked = true; expect((await get(`/example/${token}`)).status).toBe(404);
});

it("fails closed on an outage even with a warm snapshot", async () => {
  await get(`/examples/${slug}`); outage = true;
  const response = await get(`/examples/${slug}`);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain(secret);
});

it("rejects ambiguous or invalid links and disabled pages", async () => {
  expect((await get("/proposal/bad")).status).toBe(404);
  expect((await get(`/proposal/${token}?version=${id}&version=${id}`)).status).toBe(404);
  expect(reads).toHaveLength(0);
  expect((await get(`/examples/${slug}?page=missing`)).status).toBe(404);
});

it("projects only public snapshot fields and safely encodes untrusted content", async () => {
  const previous = snapshot.data.recipient;
  snapshot.data.recipient = { displayName: '</script><script>alert("injection")</script>' };
  try {
    const html = await (await get(`/proposal/${token}`)).text();
    expect(html).not.toContain('"PRIVATE_SERVICE_KEY"'); expect(html).not.toContain("PRIVATE_STORAGE_PATH");
    expect(html).not.toContain('<script>alert("injection")');
    expect(html).toContain('\\u003c/script>');
    expect(html).toContain(`pdf?version=${id}`);
    expect(html).toContain('data-testid="proposal-loading"');
  } finally { snapshot.data.recipient = previous; }
});
