// Disposable Stripe sandbox check of the commercial plan and GST; never accepts live keys.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

const env = parseEnv(readFileSync(".env.local", "utf8"));
if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Sandbox key required");
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-09-30.endive", maxNetworkRetries: 2 });
const plan = JSON.parse(env.BILLING_PLANS_JSON).find((item) => item.id === "agency-monthly-v1");
assert.ok(plan?.gstTaxRateId, "Run setup-billing-agency-plan.mjs first");
const run = randomUUID();
const customer = await stripe.customers.create({ name: "StayPack commercial plan verification — sandbox only", metadata: { run } });
let subscription;
const evidence = { run, customerId: customer.id, planId: plan.id, status: "pending", livemode: false };
try {
  const method = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: method.id } });
  subscription = await stripe.subscriptions.create({ customer: customer.id,
    items: [{ price: plan.basePriceId }, { price: plan.calculatorPriceId }, { price: plan.reportPriceId }],
    default_tax_rates: [plan.gstTaxRateId], metadata: { purpose: "commercial_plan_verification", run } });
  assert.equal(subscription.status, "active");
  const initial = await stripe.invoices.retrieve(subscription.latest_invoice);
  assert.equal(initial.amount_paid, 21890, "A$199 base + A$19.90 GST");
  Object.assign(evidence, { subscriptionId: subscription.id, baseInvoiceId: initial.id, basePaidCents: initial.amount_paid });
  for (const [kind, quantity] of [["calculator", 105], ["report", 35]]) {
    const params = { identifier: `${run}-${kind}`, event_name: kind === "calculator" ? plan.calculatorEventName : plan.reportEventName,
      timestamp: Math.floor(Date.now() / 1000), payload: { stripe_customer_id: customer.id, value: String(quantity) } };
    await stripe.billing.meterEvents.create(params, { idempotencyKey: params.identifier });
    await stripe.billing.meterEvents.create(params, { idempotencyKey: params.identifier });
  }
  let invoice;
  for (let attempt = 0; attempt < 24; attempt++) {
    invoice = await stripe.invoices.createPreview({ subscription: subscription.id });
    if (invoice.amount_due === 25190) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  assert.equal(invoice.amount_due, 25190, "A$199 + A$25 reports + A$5 calculators + A$22.90 GST");
  Object.assign(evidence, { status: "passed", expectedNextInvoiceCents: 25190, actualNextInvoiceCents: invoice.amount_due,
    lines: invoice.lines.data.map((line) => ({ description: line.description, quantity: line.quantity, amountCents: line.amount, taxes: line.taxes })) });
} finally {
  if (subscription) await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false });
  await stripe.customers.del(customer.id);
  Object.assign(evidence, { cleanedUp: true, checkedAt: new Date().toISOString() });
  writeFileSync(".codex/billing-agency-verification.json", JSON.stringify(evidence, null, 2) + "\n");
}
console.log(JSON.stringify(evidence, null, 2));
