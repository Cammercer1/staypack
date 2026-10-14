import { afterEach, expect, it, vi } from "vitest";
import { POST as checkout } from "./checkout/route";
import { POST as portal } from "./portal/route";
import { POST as webhook } from "./webhook/route";
import { POST as usageSync } from "./usage-sync/route";
import scheduledSync from "@/netlify/functions/billing-usage-sync.mjs";

const calls = vi.hoisted(() => ({ checkout: vi.fn(), portal: vi.fn(), webhook: vi.fn(), usage: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgencyAdmin: calls.auth }));
vi.mock("@/lib/billing/server", () => ({ createBillingCheckout: calls.checkout, createBillingPortal: calls.portal }));
vi.mock("@/lib/billing/webhook", () => ({ processBillingWebhook: calls.webhook }));
vi.mock("@/lib/billing/usage", () => ({ dispatchUsage: calls.usage }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each([undefined, "disabled"])("cannot start payments or dispatch usage when billing mode is %s", async (mode) => {
  vi.stubEnv("BILLING_MODE", mode);
  vi.stubEnv("BILLING_CRON_SECRET", "fixture-secret");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const request = () => new Request("https://staypack.app/api/billing", {
    method: "POST", headers: { authorization: "Bearer fixture-secret" }, body: "{}",
  });
  for (const handler of [checkout, portal, webhook]) expect((await handler(request())).status).toBe(503);
  expect(await (await usageSync(request())).json()).toEqual({ skipped: true });
  expect((await scheduledSync()).status).toBe(204);
  for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
