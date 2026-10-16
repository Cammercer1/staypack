import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.access }));
import { GET, POST } from "@/app/api/clients/route";
import { GET as DETAIL, PATCH } from "@/app/api/clients/[id]/route";

const id = "10000000-0000-4000-8000-000000000001";
const params = { params: Promise.resolve({ id }) };
const timestamp = "2026-10-16T00:00:00Z";
const request = (body: unknown) => new Request("http://localhost/api/clients", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ supabase: { rpc: mocks.rpc }, agency: { id: "authorized-agency" } });
  mocks.rpc.mockResolvedValue({ data: { id, name: "Jordan Taylor", updated_at: timestamp }, error: null });
});

it("searches literal names, email and phone through a scoped RPC with bounded pagination", async () => {
  mocks.rpc.mockResolvedValue({ data: { clients: [], total: 0 }, error: null });
  const response = await GET(new Request("http://localhost/api/clients?q=%25%27%2Cemail.ilike.*&page=2&archived=all&agency_id=attacker"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ clients: [], total: 0, page: 2, pageSize: 30 });
  expect(mocks.rpc).toHaveBeenCalledWith("list_agency_clients", {
    p_agency_id: "authorized-agency", p_search: "%',email.ilike.*", p_page: 2, p_page_size: 30, p_archived: "all",
  });
});

it("normalizes new private client details and ignores caller-supplied agency identity", async () => {
  const response = await POST(request({ name: " Jordan Taylor ", email: "Jordan@Example.test ", phone: "0400 000 001", agency_id: "attacker" }));
  expect(response.status).toBe(201);
  expect(mocks.rpc).toHaveBeenCalledWith("save_agency_client", {
    p_agency_id: "authorized-agency", p_client_id: null, p_archived: false, p_expected_updated_at: null,
    p_client: { name: "Jordan Taylor", email: "jordan@example.test", phone: "0400 000 001", phone_e164: "+61400000001" },
  });
});

it("supports lookup of a full-length client email without truncating it", async () => {
  const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  expect(email.length).toBe(254);
  mocks.rpc.mockResolvedValue({ data: { clients: [], total: 0 }, error: null });
  expect((await GET(new Request(`http://localhost/api/clients?q=${encodeURIComponent(email)}&archived=all`))).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("list_agency_clients", expect.objectContaining({ p_search: email, p_archived: "all", p_agency_id: "authorized-agency" }));
});

it("requires valid names, contact details and update timestamps before writing", async () => {
  expect((await POST(request({ name: "", email: "not-email" }))).status).toBe(400);
  expect((await POST(request({ name: "Jordan", phone: "unknown" }))).status).toBe(400);
  expect((await PATCH(request({ name: "Jordan", archived: false }), params)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("updates only the client directory through stale-edit protection", async () => {
  expect((await PATCH(request({ name: "Jordan New", email: "new@example.test", phone: "", archived: true, expected_updated_at: timestamp }), params)).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("save_agency_client", expect.objectContaining({
    p_agency_id: "authorized-agency", p_client_id: id, p_archived: true, p_expected_updated_at: timestamp,
  }));
  expect(JSON.stringify(mocks.rpc.mock.calls)).not.toMatch(/reports|recipient|final_report_json|billing/);
});

it("returns conflict for duplicate identities and stale edits", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "Select the existing client." } });
  const response = await POST(request({ name: "Jordan", email: "jordan@example.test" }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "Select the existing contact." });
});

it("loads scoped client history and returns 404 for an inaccessible client", async () => {
  mocks.rpc.mockResolvedValue({ data: { client: { id }, reports: [], leads: [], reportsTotal: 0, leadsTotal: 0 }, error: null });
  expect((await DETAIL(new Request("http://localhost"), params)).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("get_agency_client", { p_agency_id: "authorized-agency", p_client_id: id });
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT404", message: "Client not found" } });
  expect((await DETAIL(new Request("http://localhost"), params)).status).toBe(404);
});

it("authenticates every directory operation before querying private data", async () => {
  mocks.access.mockRejectedValue(new Error("Agency access required"));
  expect((await GET(new Request("http://localhost/api/clients"))).status).toBe(400);
  expect((await POST(request({ name: "Jordan" }))).status).toBe(400);
  expect((await DETAIL(new Request("http://localhost"), params)).status).toBe(400);
  expect((await PATCH(request({}), params)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
