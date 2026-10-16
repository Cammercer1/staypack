import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "./route";
const id = "6500bfd0-04d8-4919-b458-84e9ec0ce331";
const value = { mode: "named", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678" };
const request = (body = value) => new Request("https://staypack.app/api/marketing/str-calculator/leads/id/contact", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ agency: { id: "trusted-agency" }, user: { id: "trusted-user" } });
  mocks.rpc.mockResolvedValue({ data: { contact: { id, name: value.name } }, error: null });
});
it("uses authenticated ownership and a single private atomic save", async () => {
  const response = await POST(request({ ...value, ...{ agency_id: "foreign", user_id: "foreign" } }), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_calculator_enquiry_contact", { p_agency_id: "trusted-agency", p_user_id: "trusted-user", p_lead_id: id,
    p_recipient: { ...value, contact_id: null, phone_e164: "+61412345678" } });
});
it("does not write without authentication", async () => {
  mocks.auth.mockRejectedValue(new Error("Authentication required"));
  await POST(request(), { params: Promise.resolve({ id }) });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([{ ...value, mode: "general" }, { ...value, name: "" }, { ...value, email: "invalid" }])("rejects incomplete or unnamed contacts", async input => {
  expect((await POST(request(input), { params: Promise.resolve({ id }) })).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects malformed enquiry IDs before saving", async () => {
  expect((await POST(request(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([["PT409",409],["PT404",404],["42501",403],["23505",409]])("preserves ownership and conflict errors (%s)", async (code, status) => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "Review this client" } });
  const response = await POST(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: "Review this contact" });
});
