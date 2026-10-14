import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/requireUser", () => ({ requireUser: vi.fn() }));
import { publishedProspectProposal, publishedProspectProposalBySlug } from "./server";

const token = "a".repeat(64);
const slug = "property-providers/6-33-malvern-avenue-manly";
const snapshot = { version: 1, data: createProposalFixture(), draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [] };
let requests: URL[];
let rows: unknown[];

beforeEach(() => {
  requests = [];
  rows = [{ id: "example", public_slug: slug, final_report_json: snapshot }];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.com");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key");
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    requests.push(new URL(input));
    return Response.json(rows);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("both URL formats require a published, non-revoked example and return only its public snapshot", async () => {
  expect((await publishedProspectProposal(token))?.snapshot).toEqual(snapshot);
  expect((await publishedProspectProposalBySlug(slug))?.public_slug).toBe(slug);
  expect(requests[0].searchParams.get("public_token")).toBe(`eq.${token}`);
  expect(requests[1].searchParams.get("public_slug")).toBe(`eq.${slug}`);
  for (const url of requests) {
    expect(url.searchParams.get("published_at")).toBe("not.is.null");
    expect(url.searchParams.get("revoked_at")).toBe("is.null");
    expect(url.searchParams.get("select")).toBe("id,public_slug,final_report_json");
  }
});

it("checks access again after a proposal is revoked", async () => {
  await publishedProspectProposalBySlug(slug);
  rows = [];
  expect(await publishedProspectProposalBySlug(slug)).toBeNull();
  expect(await publishedProspectProposal(token)).toBeNull();
  expect(requests).toHaveLength(3);
});

it("rejects invalid links without database access", async () => {
  expect(await publishedProspectProposal("invalid")).toBeNull();
  expect(await publishedProspectProposalBySlug("company/../private")).toBeNull();
  expect(requests).toHaveLength(0);
});

it("fails closed on a database error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  await expect(publishedProspectProposalBySlug(slug)).rejects.toThrow("temporarily unavailable");
});
