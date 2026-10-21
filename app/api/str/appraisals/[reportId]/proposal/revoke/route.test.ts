import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/digital-proposals/server", async importActual => {
  const actual = await importActual<typeof import("@/lib/digital-proposals/server")>();
  return { ProposalError: actual.ProposalError, requireProposalAppraisalAccess: mocks.access };
});
vi.mock("@/lib/digital-proposals/http", () => ({
  proposalRequest: (request: Request) => request.json(),
  proposalApiError: (error: { message: string; status?: number }) => Response.json({ error: error.message }, { status: error.status ?? 400 }),
}));
vi.mock("@/lib/str-appraisals/api", () => ({ privateJson: (body: unknown) => Response.json(body) }));

const agencyId = "00000000-0000-4000-8000-000000000001";
const reportId = "00000000-0000-4000-8000-000000000002";
const versionId = "00000000-0000-4000-8000-000000000003";
const linkId = "00000000-0000-4000-8000-000000000004";
const firstRevokedAt = "2026-10-21T01:00:00Z";
const send = (body: unknown = { versionId, linkId }) => POST(new Request(`https://staypack.app/api/str/appraisals/${reportId}/proposal/revoke`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({ reportId }) });

function query(result: { data: { id: string; revoked_at: string }[] | null; error: object | null }) {
  const builder = {
    update: vi.fn(() => builder), select: vi.fn(() => builder), eq: vi.fn(() => builder),
    is: vi.fn(() => builder), not: vi.fn(() => builder), order: vi.fn(() => builder), limit: vi.fn(() => builder),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ agency: { id: agencyId }, report: { id: reportId } });
});

it("revokes only active rows by link identity even if the displayed version is stale", async () => {
  const update = query({ data: [{ id: linkId, revoked_at: firstRevokedAt }], error: null });
  mocks.from.mockReturnValue(update);
  const response = await send();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ revokedAt: firstRevokedAt });
  expect(update.is).toHaveBeenCalledWith("revoked_at", null);
  expect(update.eq.mock.calls).toEqual([["agency_id", agencyId], ["report_id", reportId], ["id", linkId]]);
  expect(mocks.from).toHaveBeenCalledTimes(1);
});

it("returns the original revocation receipt when an already-revoked link is retried", async () => {
  const update = query({ data: [], error: null });
  const read = query({ data: [{ id: linkId, revoked_at: firstRevokedAt }], error: null });
  mocks.from.mockReturnValueOnce(update).mockReturnValueOnce(read);
  const response = await send();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ revokedAt: firstRevokedAt });
  expect(update.is).toHaveBeenCalledWith("revoked_at", null);
  expect(read.update).not.toHaveBeenCalled();
  expect(read.not).toHaveBeenCalledWith("revoked_at", "is", null);
  expect(read.eq.mock.calls).toEqual([["agency_id", agencyId], ["report_id", reportId], ["id", linkId]]);
});

it("returns the same receipt to two revokers when only one conditional update wins", async () => {
  const winner = query({ data: [{ id: linkId, revoked_at: firstRevokedAt }], error: null });
  const waitingUpdate = query({ data: [], error: null });
  const read = query({ data: [{ id: linkId, revoked_at: firstRevokedAt }], error: null });
  mocks.from.mockReturnValueOnce(winner).mockReturnValueOnce(waitingUpdate).mockReturnValueOnce(read);
  const responses = await Promise.all([send(), send()]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  expect(await Promise.all(responses.map(response => response.json()))).toEqual([{ revokedAt: firstRevokedAt }, { revokedAt: firstRevokedAt }]);
  expect(waitingUpdate.is).toHaveBeenCalledWith("revoked_at", null);
  expect(read.update).not.toHaveBeenCalled();
});

it("retains legacy version-scoped revocation when no link identity was supplied", async () => {
  const update = query({ data: [], error: null });
  const read = query({ data: [{ id: linkId, revoked_at: firstRevokedAt }], error: null });
  mocks.from.mockReturnValueOnce(update).mockReturnValueOnce(read);
  expect((await send({ versionId })).status).toBe(200);
  expect(update.eq).toHaveBeenCalledWith("version_id", versionId);
  expect(read.eq).toHaveBeenCalledWith("version_id", versionId);
});

it("returns 404 only when the agency-scoped link does not exist", async () => {
  mocks.from.mockReturnValue(query({ data: [], error: null }));
  expect((await send()).status).toBe(404);
});

it("does not claim success or a missing link when the database update fails", async () => {
  mocks.from.mockReturnValue(query({ data: null, error: { code: "57014" } }));
  expect((await send()).status).toBe(503);
  expect(mocks.from).toHaveBeenCalledTimes(1);
});
