import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
vi.mock("server-only", () => ({}));
import { publishedProspectProposal, publishedProspectProposalBySlug, prospectLoadingBrand } from "./published";

const token = "a".repeat(64);
const slug = "property-providers/6-33-malvern-avenue-manly";
const snapshot = { version: 1, data: createProposalFixture(), draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [] };
const id = "00000000-0000-4000-8000-000000000001";
let requests: { url: URL; init: RequestInit }[];
let rows: unknown[];
let contentReads: number;
let contents: Map<string, unknown>;

beforeEach(() => {
  requests = [];
  rows = [{ id, public_slug: slug, published_at: "2026-10-13T00:00:00Z" }];
  contentReads = 0; contents = new Map();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.com");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key");
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    requests.push({ url, init });
    if (init.cache === "force-cache") {
      if (!contents.has(input)) {
        contentReads++;
        contents.set(input, url.searchParams.get("select") === "final_report_json" ? [{ final_report_json: snapshot }] : [{ name: snapshot.data.agency.name, logoUrl: snapshot.data.agency.logoUrl, primary: snapshot.brand.primary, primaryText: snapshot.brand.primaryText }]);
      }
      return Response.json(contents.get(input));
    }
    return Response.json(rows);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("both URL formats require a published, non-revoked example and return only its public snapshot", async () => {
  expect((await publishedProspectProposal(token))?.snapshot).toEqual(snapshot);
  expect((await publishedProspectProposalBySlug(slug))?.public_slug).toBe(slug);
  const access = requests.filter(request => request.init.cache === "no-store");
  expect(access[0].url.searchParams.get("public_token")).toBe(`eq.${token}`);
  expect(access[1].url.searchParams.get("public_slug")).toBe(`eq.${slug}`);
  for (const { url } of access) {
    expect(url.searchParams.get("published_at")).toBe("not.is.null");
    expect(url.searchParams.get("revoked_at")).toBe("is.null");
    expect(url.searchParams.get("select")).toBe("id,public_slug,published_at");
  }
  expect(contentReads).toBe(1); // Token and slug reuse the same frozen content, never the access decision.
});

it("checks access again after a proposal is revoked", async () => {
  await publishedProspectProposalBySlug(slug);
  rows = [];
  expect(await publishedProspectProposalBySlug(slug)).toBeNull();
  expect(await publishedProspectProposal(token)).toBeNull();
  expect(requests).toHaveLength(4);
  expect(contentReads).toBe(1);
});

it("rejects invalid links without database access", async () => {
  expect(await publishedProspectProposal("invalid")).toBeNull();
  expect(await publishedProspectProposalBySlug("company/../private")).toBeNull();
  expect(requests).toHaveLength(0);
});

it("fails closed on a database error", async () => {
  await publishedProspectProposalBySlug(slug); // Already warm: no stale-on-error authorization.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  await expect(publishedProspectProposalBySlug(slug)).rejects.toThrow("temporarily unavailable");
});

it("only returns client branding before access and cannot use that cache to authorize a revoked report", async () => {
  const branding = await prospectLoadingBrand("public_slug", slug);
  expect(Object.keys(branding!).sort()).toEqual(["logoUrl", "name", "primary", "primaryText"]);
  expect(requests[0].url.searchParams.get("select")).not.toContain("property");
  rows = [];
  expect(await prospectLoadingBrand("public_slug", slug)).toEqual(branding);
  expect(await publishedProspectProposalBySlug(slug)).toBeNull();
  expect(requests.at(-1)?.init.cache).toBe("no-store");
});

it("uses a new content key if publication changes", async () => {
  await publishedProspectProposalBySlug(slug);
  rows = [{ id, public_slug: slug, published_at: "2026-11-09T00:00:00Z" }];
  await publishedProspectProposalBySlug(slug);
  expect(contentReads).toBe(2);
});
