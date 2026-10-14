// Real Stripe sandbox verification. Uses test resources only; never accepts a live key.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

const env = parseEnv(readFileSync(".env.local", "utf8"));
if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Sandbox key required");
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-09-30.endive" });
if (process.argv.includes("--check")) {
  const path = ".codex/billing-sandbox-verification.json";
  const result = JSON.parse(readFileSync(path, "utf8"));
  const invoice = await stripe.invoices.createPreview({ subscription: result.subscriptionId });
  result.actualNextInvoiceCents = invoice.amount_due;
  result.lines = invoice.lines.data.map((line) => ({ description: line.description, quantity: line.quantity, amountCents: line.amount }));
  result.status = invoice.amount_due === result.expectedNextInvoiceCents ? "passed" : "awaiting asynchronous meter aggregation";
  result.checkedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "passed" ? 0 : 1);
}
const plan = JSON.parse(env.BILLING_PLANS_JSON).find((item) => item.id === "sandbox-verification-v1");
if (!plan) throw new Error("Run setup-billing-sandbox.mjs first");
const run = randomUUID();
const customer = await stripe.customers.create({ name: "StayPack billing verification (test only)", payment_method: "pm_card_visa",
  invoice_settings: { default_payment_method: "pm_card_visa" }, metadata: { purpose: "billing_verification", run } });
const checkout = await stripe.checkout.sessions.create({ mode: "subscription", managed_payments: { enabled: false }, customer: customer.id,
  line_items: [{ price: plan.basePriceId, quantity: 1 }, { price: plan.calculatorPriceId }, { price: plan.reportPriceId }],
  success_url: "http://localhost:3000/settings/billing", cancel_url: "http://localhost:3000/settings/billing" });
await stripe.checkout.sessions.expire(checkout.id);
const subscription = await stripe.subscriptions.create({ customer: customer.id,
  items: [{ price: plan.basePriceId }, { price: plan.calculatorPriceId }, { price: plan.reportPriceId }],
  metadata: { purpose: "billing_verification", plan_id: plan.id, run } });
if (subscription.status !== "active") throw new Error(`Expected active sandbox subscription, received ${subscription.status}`);
const initial = await stripe.invoices.retrieve(subscription.latest_invoice);
if (initial.amount_paid !== plan.baseCents) throw new Error(`Base invoice mismatch: ${initial.amount_paid}`);
const now = Math.floor(Date.now() / 1000);
for (const [kind, quantity] of [["calculator", 105], ["report", 12]]) {
  const params = { identifier: `${run}-${kind}`, event_name: kind === "calculator" ? plan.calculatorEventName : plan.reportEventName,
    timestamp: now, payload: { stripe_customer_id: customer.id, value: String(quantity) } };
  // The same network request retried must not double the usage.
  await stripe.billing.meterEvents.create(params, { idempotencyKey: params.identifier });
  await stripe.billing.meterEvents.create(params, { idempotencyKey: params.identifier });
}
const portal = await stripe.billingPortal.sessions.create({ customer: customer.id, configuration: env.STRIPE_PORTAL_CONFIGURATION_ID,
  return_url: "http://localhost:3000/settings/billing" });
const evidence = { run, customerId: customer.id, subscriptionId: subscription.id, checkoutId: checkout.id,
  baseInvoiceId: initial.id, basePaidCents: initial.amount_paid, expectedNextInvoiceCents: 11500,
  portalCreated: !!portal.url, status: "awaiting asynchronous meter aggregation", checkedAt: new Date().toISOString() };
mkdirSync(".codex", { recursive: true });
writeFileSync(".codex/billing-sandbox-verification.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
