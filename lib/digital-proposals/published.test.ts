import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "./fixtures";
import { BRAND_DEFAULTS } from "./brand";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";
vi.mock("server-only", () => ({}));
import { publishedProposal, publishedProposalAccess } from "./published";

const id = "00000000-0000-4000-8000-000000000001";
const token = "a".repeat(64);
const snapshot = { version: 1, data: createProposalFixture(), draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [], assignment: null };
let access: Record<string, unknown>, reads: { url: URL; init: RequestInit }[], contents: Map<string, unknown>;
beforeEach(() => {
  access = { id, version: { id, agency_id: id, report_id: id, content_hash: "b".repeat(64), pdf_status: "pending", pdf_path: null, report: { agency_id: id, listing: { agency_id: id } } } };
  reads = []; contents = new Map();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.com"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key");
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input); reads.push({ url, init });
    if (url.pathname.endsWith("digital_proposal_links")) return Response.json(access ? [access] : []);
    if (!contents.has(input)) contents.set(input, [structuredClone(snapshot)]);
    return Response.json(contents.get(input));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("uses one fresh scoped join and a separate immutable content cache without exposing PDF source", async () => {
  const result = await publishedProposal(token);
  expect(result.snapshot.data.property.address).toBe(snapshot.data.property.address);
  expect(result.snapshot).not.toHaveProperty("pdfReport");
  expect(reads).toHaveLength(2);
  expect(reads[0].init.cache).toBe("no-store");
  expect(reads[0].url.searchParams.get("select")).toContain("reports!inner");
  expect(reads[0].url.searchParams.get("select")).toContain("listings!inner");
  for (const field of ["revoked_at", "version.revoked_at"]) expect(reads[0].url.searchParams.get(field)).toBe("is.null");
  for (const field of ["version.report.status", "version.report.listing.status"]) expect(reads[0].url.searchParams.get(field)).toBe("neq.archived");
  expect(reads[1].init.cache).toBe("force-cache");
  expect(reads[1].url.searchParams.get("select")).not.toContain("pdfReport");
  expect(reads[1].url.searchParams.get("content_hash")).toBe(`eq.${"b".repeat(64)}`);
});

it("rejects revoked or archived access even after the snapshot was cached", async () => {
  await publishedProposal(token);
  access = null as unknown as Record<string, unknown>;
  await expect(publishedProposal(token)).rejects.toMatchObject({ status: 404 });
  expect(reads).toHaveLength(3); // No cached content lookup after failed access.
});

it("reads PDF availability fresh on every visit, independently of cached content", async () => {
  expect((await publishedProposal(token)).pdf_status).toBe("pending");
  Object.assign(access.version as object, { pdf_status: "ready", pdf_path: "private/proposal.pdf" });
  expect((await publishedProposal(token)).pdf_status).toBe("ready");
  expect(contents.size).toBe(1);
});

it("fails closed on cross-agency listing ownership", async () => {
  Object.assign(access.version as object, { report: { agency_id: id, listing: { agency_id: "00000000-0000-4000-8000-000000000002" } } });
  await expect(publishedProposal(token)).rejects.toMatchObject({ status: 404 });
  expect(reads).toHaveLength(1);
});

it("does not contact the database for malformed share tokens", async () => {
  await expect(publishedProposalAccess("bad")).rejects.toMatchObject({ status: 404 });
  expect(reads).toHaveLength(0);
});

it("reports transient failures without serving cached content or claiming the link is invalid", async () => {
  await publishedProposal(token);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(publishedProposal(token)).rejects.toMatchObject({ status: 503 });
});

it("pins an already-open proposal to a served version after the stable pointer moves", async () => {
  const historical = structuredClone(access);
  const newerId = "00000000-0000-4000-8000-000000000002";
  Object.assign(access.version as object, { id: newerId, content_hash: "c".repeat(64) });
  const originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    if (url.pathname.endsWith("digital_proposal_link_versions")) {
      reads.push({ url, init });
      return Response.json([{ link: { id }, version: historical.version }]);
    }
    return originalFetch(input, init);
  }));
  const result = await publishedProposal(token, id);
  expect(result.id).toBe(id);
  expect(result.legacy).toBe(false);
  expect(reads[0].init.cache).toBe("no-store");
  expect(reads[0].url.searchParams.get("version_id")).toBe(`eq.${id}`);
  expect(reads[0].url.searchParams.get("link.token")).toBe(`eq.${token}`);
  expect(reads[0].url.searchParams.get("link.revoked_at")).toBe("is.null");
  expect(reads[1].url.searchParams.get("id")).toBe(`eq.${id}`);
});

it("rejects a snapshot that was never served by this token before reading cached content", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
  await expect(publishedProposal(token, id)).rejects.toMatchObject({ status: 404 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps exact legacy snapshots readable before migration and fails closed for other versions", async () => {
  const originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    if (new URL(input).pathname.endsWith("digital_proposal_link_versions")) return Response.json({ code: "PGRST205" }, { status: 404 });
    return originalFetch(input, init);
  }));
  expect((await publishedProposalAccess(token, id)).legacy).toBe(true);
  await expect(publishedProposalAccess(token, "00000000-0000-4000-8000-000000000002")).rejects.toMatchObject({ status: 404 });
});

it("does not downgrade membership authorization on operational database errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "57014" }, { status: 503 })));
  await expect(publishedProposalAccess(token, id)).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("resolves the current public target when both direct and history relationships exist", async () => {
  const originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    if (url.pathname.endsWith("digital_proposal_links") && url.searchParams.get("select")?.includes("version:digital_proposal_versions!inner(")) {
      return Response.json({ code: "PGRST201", message: "Multiple relationships found" }, { status: 300 });
    }
    return originalFetch(input, init);
  }));
  const result = await publishedProposal(token);
  expect(result.id).toBe(id);
  expect(result.snapshot.data.property.address).toBe(snapshot.data.property.address);
  expect(reads[0].url.searchParams.get("select")).toContain("version:digital_proposal_versions!digital_proposal_links_agency_id_report_id_version_id_fkey!inner(");
});
