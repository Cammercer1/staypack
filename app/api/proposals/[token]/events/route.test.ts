import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ published: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/digital-proposals/published", () => ({ publishedProposal: mocks.published }));
vi.mock("@/lib/digital-proposals/http", () => ({
  proposalRequest: (request: Request) => request.json(),
  proposalApiError: (error: { message: string; status?: number }) => Response.json({ error: error.message }, { status: error.status ?? 400 }),
}));
const versionId = "00000000-0000-4000-8000-000000000001";
const event = { id: "00000000-0000-4000-8000-000000000002", session: "00000000-0000-4000-8000-000000000003", kind: "open", target: "proposal", versionId };
const send = (body: unknown) => POST(new Request("https://staypack.app/api/proposals/token/events", {
  method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" }, body: JSON.stringify(body),
}), { params: Promise.resolve({ token: "token" }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.published.mockResolvedValue({ id: versionId, legacy: false, snapshot: {} });
  mocks.rpc.mockResolvedValue({ error: null });
});

it("records the rendered version even if the stable link has since moved", async () => {
  expect((await send(event)).status).toBe(204);
  expect(mocks.published).toHaveBeenCalledWith("token", versionId);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("record_proposal_event_v2", {
    p_token: "token", p_id: event.id, p_session: event.session, p_kind: "open", p_target: "proposal", p_version_id: versionId,
  });
});

it("ignores an old unversioned client rather than attributing it to the current stable target", async () => {
  const legacyEvent = { ...event, versionId: undefined };
  expect((await send(legacyEvent)).status).toBe(204);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("uses the old event writer only after the resolver establishes legacy access", async () => {
  mocks.published.mockResolvedValue({ id: versionId, legacy: true, snapshot: {} });
  expect((await send(event)).status).toBe(204);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("record_proposal_event", {
    p_token: "token", p_id: event.id, p_session: event.session, p_kind: "open", p_target: "proposal",
  });
});

it("does not fall back to unversioned recording when the new writer fails", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
  expect((await send(event)).status).toBe(503);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc.mock.calls[0][0]).toBe("record_proposal_event_v2");
});

it("rejects a snapshot not authorized by the link before writing activity", async () => {
  mocks.published.mockRejectedValue(Object.assign(new Error("Proposal not available."), { status: 404 }));
  expect((await send(event)).status).toBe(404);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("rejects malformed version IDs before resolving access", async () => {
  expect((await send({ ...event, versionId: "invalid" })).status).toBe(400);
  expect(mocks.published).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
