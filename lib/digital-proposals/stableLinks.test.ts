import { beforeEach, expect, it, vi } from "vitest";
import { loadProposalWorkspace, publishProposal } from "./server";
import { createProposalFixture } from "./fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";

const mocks = vi.hoisted(() => ({ preserve: vi.fn(), rpc: vi.fn() }));
vi.mock("./imageStorage", () => ({ preserveProposalImages: mocks.preserve }));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secondId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const stamp = "2026-10-21T00:00:00Z";
const first = { id, draft_revision: 1, created_at: stamp, revoked_at: null, share_token: "a".repeat(64), pdf_status: "ready", source_fingerprint: "original", digital_proposal_links: [] };
const second = { ...first, id: secondId, created_at: "2026-10-21T01:00:00Z", share_token: "b".repeat(64) };
const link = { id, token: "a".repeat(64), version_id: id, created_at: stamp, updated_at: "2026-10-21T02:00:00Z", revoked_at: null as string | null,
  is_primary: true, published_revision: 3, published_source_fingerprint: "source", version: first };
function context(options: { links?: typeof link[]; versions?: typeof first[]; missingSchema?: boolean; ambiguousRelationships?: boolean } = {}) {
  const from = (table: string) => {
    const result = { data: table === "digital_proposal_drafts" ? { draft_json: DEFAULT_PROPOSAL_DRAFT, revision: 3 }
      : table === "digital_proposal_versions" ? options.versions ?? [second, first]
      : table === "digital_proposal_links" ? options.links ?? [link]
      : table === "digital_proposal_link_versions" ? [{ link_id: id, version_id: id }, { link_id: id, version_id: secondId }] : [],
      error: table === "digital_proposal_links" && options.missingSchema ? { code: "42703", message: "column is_primary does not exist" } : null };
    const builder = { select: (selection: string) => {
      if (options.ambiguousRelationships && ["digital_proposal_versions", "digital_proposal_links"].includes(table)
        && !selection.includes("!digital_proposal_links_agency_id_report_id_version_id_fkey(")) {
        result.error = { code: "PGRST201", message: "Multiple relationships found: direct current version and served-version history" };
      }
      return builder;
    }, eq: () => builder, order: () => builder, limit: () => Promise.resolve(result), maybeSingle: () => Promise.resolve(result), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return builder;
  };
  return { agency: { id }, report: { id, final_estimate_json: {}, updated_at: stamp }, listing: { updated_at: stamp }, appraisal: { kind: "str", updated_at: stamp },
    supabase: { from }, data: createProposalFixture(), availableAgents: [], assignment: { name: "Test", version: 1, defaults: DEFAULT_PROPOSAL_DRAFT }, sourceFingerprint: "source",
  } as unknown as Parameters<typeof publishProposal>[0];
}
beforeEach(() => vi.clearAllMocks());

it("reloads the latest publication receipt when A -> B -> A reuses an older snapshot", async () => {
  const workspace = await loadProposalWorkspace(context());
  expect(workspace.shareLink).toMatchObject({ path: `/proposal/${link.token}`, versionId: id, draft_revision: 3, source_fingerprint: "source" });
  expect(workspace.versions.find(version => version.id === id)).toMatchObject({ draft_revision: 1, path: `/proposal/${link.token}?version=${id}` });
  expect(workspace.versions.find(version => version.id === secondId)?.pdfPath).toBe(`/api/proposals/${link.token}/pdf?version=${secondId}`);
});

it("includes the current pointer even when its older snapshot is outside recent history", async () => {
  const workspace = await loadProposalWorkspace(context({ versions: [second] }));
  expect(workspace.versions.some(version => version.id === workspace.shareLink?.versionId)).toBe(true);
});

it("keeps a revoked primary explicit so other historical tokens cannot become the main link", async () => {
  const workspace = await loadProposalWorkspace(context({ links: [{ ...link, revoked_at: stamp }] }));
  expect(workspace.shareLink?.revoked_at).toBe(stamp);
});

it("shows the same newest legacy token that the first deliberate publish will adopt", async () => {
  const workspace = await loadProposalWorkspace(context({ links: [{ ...link, is_primary: false }] }));
  expect(workspace.shareLink).toBeNull();
  expect(workspace.versions[0]).toMatchObject({ id, path: `/proposal/${link.token}?version=${id}`, link_id: id });
});

it("keeps old workspace reads available but rejects publishing before migration without preserving images", async () => {
  const ctx = context({ missingSchema: true });
  expect((await loadProposalWorkspace(ctx)).shareLink).toBeUndefined();
  await expect(publishProposal(ctx, 3, "source")).rejects.toMatchObject({ status: 503, message: expect.stringContaining("proposal-link database update") });
  expect(mocks.preserve).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("loads current links and history when PostgREST also discovers the served-version junction", async () => {
  const workspace = await loadProposalWorkspace(context({ ambiguousRelationships: true }));
  expect(workspace.shareLink).toMatchObject({ versionId: id, path: `/proposal/${link.token}` });
  expect(workspace.versions.map(version => version.id)).toEqual([secondId, id]);
});
