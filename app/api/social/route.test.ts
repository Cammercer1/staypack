import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
const mocks = vi.hoisted(() => ({ access: vi.fn(), open: vi.fn(), origin: vi.fn(() => true) }));
vi.mock("@/lib/auth/requireUser", () => ({ requireListingAccess: mocks.access }));
vi.mock("@/lib/social/workspace", async original => ({ ...await original<typeof import("@/lib/social/workspace")>(), openOrCreateSocialPosts: mocks.open }));
vi.mock("@/lib/digital-proposals/requestOrigin", () => ({ requestOriginAllowed: mocks.origin }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const request = (extra = {}) => new Request("http://localhost/api/social", { method: "POST", body: JSON.stringify({ listing_id: id, ...extra }) });
afterEach(() => { vi.resetAllMocks(); mocks.origin.mockReturnValue(true); });
it("blocks untrusted origins before property access", async () => {
  mocks.origin.mockReturnValue(false);
  expect((await POST(request())).status).toBe(403);
  expect(mocks.access).not.toHaveBeenCalled();
});
it("rejects invalid input before property access", async () => {
  expect((await POST(request({ agency_id: "another-agency" }))).status).toBe(400);
  expect(mocks.access).not.toHaveBeenCalled();
});
it("does not generate designs for inaccessible properties", async () => {
  mocks.access.mockRejectedValue(new Error("Listing not found"));
  expect((await POST(request())).status).toBe(400);
  expect(mocks.open).not.toHaveBeenCalled();
});
it("uses the authorized agency and requires explicit archive restoration", async () => {
  const access = { supabase: {}, agency: { id: "authorized" }, listing: { id } };
  mocks.access.mockResolvedValue(access);
  mocks.open.mockResolvedValueOnce({ id: "saved", archived: true }).mockResolvedValueOnce({ id: "saved", archived: false });
  const archived = await POST(request());
  expect(archived.status).toBe(409);
  expect(await archived.json()).toMatchObject({ code: "social_archived" });
  expect(mocks.open).toHaveBeenLastCalledWith(access.supabase, access.agency, access.listing, false);
  const restored = await POST(request({ restore_archived: true }));
  expect(mocks.open).toHaveBeenLastCalledWith(access.supabase, access.agency, access.listing, true);
  expect(await restored.json()).toEqual({ id: "saved", path: "/social/saved" });
  expect(restored.headers.get("cache-control")).toBe("private, no-store");
});
