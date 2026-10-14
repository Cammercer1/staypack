// Sandbox only. Real pricing is deliberately not chosen by this script.
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import Stripe from "stripe";

const env = parseEnv(readFileSync(".env.local", "utf8"));
if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("This script only accepts sandbox keys");
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-09-30.endive", maxNetworkRetries: 2 });
const account = await stripe.accounts.retrieve(env.STRIPE_ACCOUNT_ID);
if (account.id !== env.STRIPE_ACCOUNT_ID) throw new Error("Wrong Stripe account");
const planId = "sandbox-verification-v1";
const product = await stripe.products.create({ name: "StayPack sandbox verification — sample pricing only",
  metadata: { staypack_plan_id: planId, purpose: "integration_testing_only" },
}, { idempotencyKey: `staypack-${planId}-product` });
const allMeters = await stripe.billing.meters.list({ limit: 100 });
async function meter(kind) {
  const eventName = `staypack_${kind}_v1`;
  const existing = allMeters.data.find((item) => item.event_name === eventName);
  return existing ?? stripe.billing.meters.create({ display_name: `StayPack ${kind === "report" ? "published reports" : "completed calculator estimates"}`,
    event_name: eventName, default_aggregation: { formula: "sum" },
    customer_mapping: { type: "by_id", event_payload_key: "stripe_customer_id" }, value_settings: { event_payload_key: "value" },
  }, { idempotencyKey: `staypack-meter-${kind}-v1` });
}
const calculator = await meter("calculator");
const report = await meter("report");
async function price(kind, options) {
  const lookupKey = `staypack_${planId}_${kind}`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return existing.data[0] ?? stripe.prices.create({ product: product.id, currency: "aud", tax_behavior: "exclusive",
    lookup_key: lookupKey, nickname: `Sandbox verification ${kind}`, ...options,
  }, { idempotencyKey: lookupKey });
}
const base = await price("base", { unit_amount: 10000, recurring: { interval: "month" } });
const calcPrice = await price("calculator", { billing_scheme: "tiered", tiers_mode: "graduated",
  tiers: [{ up_to: 100, unit_amount: 0 }, { up_to: "inf", unit_amount: 100 }],
  recurring: { interval: "month", usage_type: "metered", meter: calculator.id } });
const reportPrice = await price("report", { billing_scheme: "tiered", tiers_mode: "graduated",
  tiers: [{ up_to: 10, unit_amount: 0 }, { up_to: "inf", unit_amount: 500 }],
  recurring: { interval: "month", usage_type: "metered", meter: report.id } });
const plan = { id: planId, name: "Sandbox verification plan", currency: "aud", baseCents: 10000,
  includedCalculators: 100, includedReports: 10, calculatorOverageCents: 100, reportOverageCents: 500,
  basePriceId: base.id, calculatorPriceId: calcPrice.id, reportPriceId: reportPrice.id,
  calculatorEventName: calculator.event_name, reportEventName: report.event_name, taxBehavior: "exclusive" };
const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
const portal = configurations.data.find((item) => item.metadata?.staypack === "v1") ?? await stripe.billingPortal.configurations.create({
  business_profile: { headline: "Manage your StayPack subscription" }, metadata: { staypack: "v1" },
  features: { customer_update: { enabled: true, allowed_updates: ["address", "email", "name", "tax_id"] },
    invoice_history: { enabled: true }, payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" }, subscription_update: { enabled: false } },
}, { idempotencyKey: "staypack-portal-v1" });
const replacements = { BILLING_PLANS_JSON: JSON.stringify([plan]), STRIPE_PORTAL_CONFIGURATION_ID: portal.id };
const lines = readFileSync(".env.local", "utf8").split("\n").filter((line) => !(line.split("=", 1)[0] in replacements));
writeFileSync(".env.local", lines.join("\n").trimEnd() + "\n" + Object.entries(replacements).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600 });
console.log(JSON.stringify({ accountId: account.id, productId: product.id, plan, portalConfigurationId: portal.id,
  billingEnabled: false, note: "Sample sandbox amounts only. Production pricing is undecided." }, null, 2));
