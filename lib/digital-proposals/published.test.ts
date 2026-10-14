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
