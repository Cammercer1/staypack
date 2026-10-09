import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  require: vi.fn(),
  rpc: vi.fn(),
  directory: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({
  requireAgency: mock.require,
  requireAgencyAdmin: mock.require,
}));
vi.mock("@/lib/agents/loadDirectory", () => ({
  loadAgentDirectory: mock.directory,
}));
import { POST, PATCH, DELETE, GET } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const values = {
  name: " Alex ",
  email: "",
  phone: "",
  role_title: "",
  photo_url: "",
  is_default: false,
};
const request = (body: unknown) =>
  new Request("http://localhost/api/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.require.mockResolvedValue({
    agency: { id: "agency" },
    supabase: { rpc: mock.rpc },
  });
  mock.rpc.mockResolvedValue({ data: { id, ...values }, error: null });
});
it("validates before calling database and trims names", async () => {
  expect((await POST(request({ ...values, name: " " }))).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
  expect((await POST(request(values))).status).toBe(200);
  expect(mock.rpc.mock.calls[0][1].values_json.name).toBe("Alex");
});
it("scopes all updates to the authenticated agency", async () => {
  await PATCH(
    request({
      ...values,
      id,
      agency_id: "other",
      updated_at: "2026-10-09T00:00:00Z",
    }),
  );
  expect(mock.rpc.mock.calls[0][1]).toMatchObject({
    target_agency: "agency",
    target_id: id,
    operation: "save",
    expected_updated_at: "2026-10-09T00:00:00Z",
  });
});
it.each(["archive", "restore", "default"])(
  "uses atomic %s action without accepting extra data",
  async (action) => {
    await PATCH(request({ id, action, name: "Injected" }));
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({
      operation: action,
      values_json: {},
    });
  },
);
it("preserves conflict status for stale writes", async () => {
  mock.rpc.mockResolvedValue({
    data: null,
    error: { code: "40001", message: "Profile changed" },
  });
  expect((await PATCH(request({ id, action: "archive" }))).status).toBe(409);
});
it("rejects non-admin requests before any writes", async () => {
  mock.require.mockRejectedValue(new Error("Admin access required"));
  expect((await POST(request(values))).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("archives for legacy delete clients instead of permanently deleting", async () => {
  expect((await DELETE(request({ id }))).status).toBe(200);
  expect(mock.rpc.mock.calls[0][1].operation).toBe("archive");
});
it("loads archived profiles only in the directory mode", async () => {
  mock.directory.mockResolvedValue([{ id, archived_at: "yesterday" }]);
  const response = await GET(
    new Request("http://localhost/api/agents?directory=true"),
  );
  expect(await response.json()).toEqual({
    agents: [{ id, archived_at: "yesterday" }],
  });
});
it("handles malformed requests without mutations", async () => {
  expect(
    (await PATCH(request({ id: "invalid", action: "archive" }))).status,
  ).toBe(400);
  expect((await PATCH(request({ id, action: "delete" }))).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});

it("returns a matching profile and 409 for database duplicate violations", async () => {
  const duplicate = { id, name: "Existing", listings: [] };
  mock.rpc.mockResolvedValue({
    data: null,
    error: {
      code: "23505",
      message: "Agent already exists",
      details: JSON.stringify({ agent_id: id }),
    },
  });
  mock.directory.mockResolvedValue([duplicate]);
  const response = await POST(request(values));
  expect(response.status).toBe(409);
  expect((await response.json()).duplicateAgent).toEqual(duplicate);
});
