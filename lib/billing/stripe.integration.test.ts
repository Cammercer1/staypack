import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterEach, expect, it, vi } from "vitest";
import { billingPlans } from "./plans";
import { billingStripe } from "./stripe";
import { checkoutLineItems, validateStripePlan } from "./server";
import { checkoutTaxOptions } from "./tax";

afterEach(() => vi.unstubAllEnvs());
it.skipIf(process.env.BILLING_SANDBOX_INTEGRATION !== "1")("verifies the configured test catalogue against real Stripe prices and meters", async () => {
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Sandbox key required");
  for (const key of ["STRIPE_SECRET_KEY", "STRIPE_ACCOUNT_ID", "BILLING_SITE_URL", "BILLING_PLANS_JSON"]) vi.stubEnv(key, env[key]);
  vi.stubEnv("BILLING_MODE", "test");
  const stripe = await billingStripe();
  const plan = billingPlans()[0];
  await validateStripePlan(stripe, plan);
  expect(checkoutLineItems(plan)).toEqual([{ price: plan.basePriceId, quantity: 1 }, { price: plan.calculatorPriceId }, { price: plan.reportPriceId }]);
  await expect(validateStripePlan(stripe, { ...plan, includedReports: plan.includedReports + 1 })).rejects.toThrow("tiers");
  if (plan.gstTaxRateId) {
    const session = await stripe.checkout.sessions.create({ mode: "subscription", managed_payments: { enabled: false },
      line_items: checkoutLineItems(plan), ...checkoutTaxOptions(plan, false), success_url: "http://localhost:3000/settings/billing" });
    try {
      expect(session.amount_subtotal).toBe(plan.baseCents);
      expect(session.total_details?.amount_tax).toBe(Math.round(plan.baseCents * 0.1));
      expect(session.amount_total).toBe(Math.round(plan.baseCents * 1.1));
    } finally { await stripe.checkout.sessions.expire(session.id); }
  }
}, 30_000);
