import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { createBillingCheckout } from "@/lib/billing/server";
vi.mock("@/lib/auth/requireUser", () => ({ requireAgencyAdmin: vi.fn() }));
vi.mock("@/lib/billing/server", () => ({ createBillingCheckout: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("BILLING_MODE", "test"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_ACCOUNT_ID", "acct_fixture"); vi.stubEnv("BILLING_SITE_URL", "http://localhost:3000");
  vi.mocked(requireAgencyAdmin).mockResolvedValue({ agency: { id: "agency-from-session", name: "Test" } } as Awaited<ReturnType<typeof requireAgencyAdmin>>);
  vi.mocked(createBillingCheckout).mockResolvedValue("https://checkout.stripe.com/example");
});
afterEach(() => vi.unstubAllEnvs());
const request = (body: object, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/billing/checkout", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
it("bills the signed-in agency, never an agency supplied by the client", async () => {
  expect((await POST(request({ planId: "test-v1" }))).status).toBe(200);
  expect(createBillingCheckout).toHaveBeenCalledWith({ id: "agency-from-session", name: "Test" }, "test-v1");
  vi.mocked(createBillingCheckout).mockClear();
  expect((await POST(request({ planId: "test-v1", agencyId: "victim" }))).status).toBe(400);
  expect(createBillingCheckout).not.toHaveBeenCalled();
});
it("blocks ordinary members and cross-origin requests", async () => {
  vi.mocked(requireAgencyAdmin).mockRejectedValueOnce(new Error("Admin access required"));
  expect((await POST(request({ planId: "test-v1" }))).status).toBe(403);
  expect((await POST(request({ planId: "test-v1" }, "https://untrusted.example"))).status).toBe(400);
  expect(createBillingCheckout).not.toHaveBeenCalled();
});
