import { afterEach, expect, it, vi } from "vitest";
import { billingConfig, billingMode } from "./config";
afterEach(() => vi.unstubAllEnvs());
it("defaults to disabled", () => {
  vi.stubEnv("BILLING_MODE", undefined);
  expect(billingMode()).toBe("disabled");
  expect(() => billingConfig()).toThrow("not enabled");
});
it("rejects live keys in test mode", () => {
  vi.stubEnv("BILLING_MODE", "test"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_example");
  expect(() => billingConfig()).toThrow("environment");
});
it("requires an explicit HTTPS origin in live mode", () => {
  vi.stubEnv("BILLING_MODE", "live"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_example");
  vi.stubEnv("BILLING_SITE_URL", "http://localhost:3000");
  expect(() => billingConfig()).toThrow("HTTPS");
});
