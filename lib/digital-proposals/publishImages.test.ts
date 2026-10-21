import { beforeEach, expect, it, vi } from "vitest";
import { publishProposal } from "./server";
import { createProposalFixture } from "./fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";
import { type ProposalSnapshot } from "./workspace";

const mocks = vi.hoisted(() => ({ preserve: vi.fn(), rpc: vi.fn() }));
vi.mock("./imageStorage", () => ({ preserveProposalImages: mocks.preserve }));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function context() {
  const draft = structuredClone(DEFAULT_PROPOSAL_DRAFT);
  const from = (table: string) => {
    const result = { data: table === "digital_proposal_drafts" ? { draft_json: draft, revision: 1 } : [], error: null };
    const builder = { select: () => builder, eq: () => builder, order: () => builder, limit: () => Promise.resolve(result), maybeSingle: () => Promise.resolve(result), then: (resolve: (result: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return builder;
  };
  return { agency: { id }, report: { id, final_estimate_json: {}, updated_at: "2026-10-21T00:00:00Z" }, listing: { updated_at: "2026-10-21T00:00:00Z" },
    appraisal: { kind: "str", updated_at: "2026-10-21T00:00:00Z" }, supabase: { from }, data: createProposalFixture(),
    availableAgents: [], assignment: { name: "Test", version: 1, defaults: draft }, sourceFingerprint: "source",
  } as unknown as Parameters<typeof publishProposal>[0];
}
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { id, share_token: "a".repeat(64), share_link: { id, token: "a".repeat(64), version_id: id, draft_revision: 1, source_fingerprint: "source", created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z", revoked_at: null } }, error: null }); });

it("publishes the preserved snapshot only after image verification and returns the stable link separately", async () => {
  mocks.preserve.mockImplementation(async (snapshot: ProposalSnapshot) => ({ ...snapshot, data: { ...snapshot.data, property: { ...snapshot.data.property, heroImageUrl: "https://assets.test/permanent.png" } } }));
  const result = await publishProposal(context(), 1, "source");
  expect(mocks.preserve).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }), id);
  expect(mocks.rpc).toHaveBeenCalledWith("publish_digital_proposal_v3", expect.objectContaining({ p_snapshot: expect.objectContaining({ data: expect.objectContaining({ property: expect.objectContaining({ heroImageUrl: "https://assets.test/permanent.png" }) }) }) }));
  expect(mocks.preserve.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
  expect(result.shareLink.path).toBe(`/proposal/${"a".repeat(64)}`);
  expect(result.version.path).toBe(`/proposal/${"a".repeat(64)}?version=${id}`);
});

it("does not create or change a published version when image preservation fails", async () => {
  mocks.preserve.mockRejectedValue(new Error("expired source"));
  await expect(publishProposal(context(), 1, "source")).rejects.toMatchObject({ status: 503 });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
