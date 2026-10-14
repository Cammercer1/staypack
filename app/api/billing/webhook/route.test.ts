import Stripe from "stripe";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { processBillingWebhook } from "@/lib/billing/webhook";
vi.mock("@/lib/billing/webhook", () => ({ processBillingWebhook: vi.fn() }));
const secret = "whsec_test_fixture";
const payload = JSON.stringify({ id: "evt_fixture", object: "event", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_fixture" } } });
const stripe = new Stripe("sk_test_fixture");
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BILLING_MODE", "test"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_ACCOUNT_ID", "acct_fixture"); vi.stubEnv("BILLING_SITE_URL", "http://localhost:3000");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());
it("rejects a forged webhook before touching billing state", async () => {
  const response = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: payload }));
  expect(response.status).toBe(400); expect(processBillingWebhook).not.toHaveBeenCalled();
});
it("authenticates the unmodified body and processes the signed event", async () => {
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const response = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
  expect(response.status).toBe(200); expect(processBillingWebhook).toHaveBeenCalledWith(expect.objectContaining({ id: "evt_fixture" }));
});
it("returns a retryable error when persistence fails", async () => {
  vi.mocked(processBillingWebhook).mockRejectedValueOnce(new Error("Database unavailable"));
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const response = await POST(new Request("http://localhost/api/billing/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
  expect(response.status).toBe(500);
});
