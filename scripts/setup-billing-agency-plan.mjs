// Creates the agreed catalogue in the sandbox; never enables billing or enrolls customers.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import Stripe from "stripe";

const env = parseEnv(readFileSync(".env.local", "utf8"));
if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Sandbox key required");
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-09-30.endive", maxNetworkRetries: 2 });
const account = await stripe.accounts.retrieve(env.STRIPE_ACCOUNT_ID);
assert.equal(account.id, "acct_1UQJkULcZscwTgC8");
const planId = "agency-monthly-v1";
const productId = "staypack_agency_monthly_v1";
let product;
try { product = await stripe.products.retrieve(productId); }
catch (error) { if (error.code !== "resource_missing") throw error; }
product ??= await stripe.products.create({ id: productId, name: "StayPack Agency",
  description: "A$199/month plus GST per agency. Includes 30 reports and 100 calculator estimates each billing month. Additional reports A$5 each; additional calculator estimates A$1 each, plus GST. No setup fee.",
  metadata: { staypack_plan_id: planId, included_reports: "30", included_calculators: "100", gst: "10% exclusive", setup_fee: "none" },
}, { idempotencyKey: `staypack-${planId}-product` });
const meters = await stripe.billing.meters.list({ limit: 100 }).autoPagingToArray({ limit: 1000 });
async function meter(kind) {
  const eventName = `staypack_${kind}_v1`;
  const existing = meters.find((item) => item.event_name === eventName);
  if (existing) { assert.equal(existing.status, "active"); return existing; }
  return stripe.billing.meters.create({ display_name: `StayPack ${kind === "report" ? "published reports" : "completed calculator estimates"}`,
    event_name: eventName, default_aggregation: { formula: "sum" },
    customer_mapping: { type: "by_id", event_payload_key: "stripe_customer_id" }, value_settings: { event_payload_key: "value" },
  }, { idempotencyKey: `staypack-meter-${kind}-v1` });
}
const calculator = await meter("calculator");
const report = await meter("report");
async function price(kind, nickname, options) {
  const lookupKey = `staypack_${planId}_${kind}`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const result = existing.data[0] ?? await stripe.prices.create({ product: product.id, currency: "aud", tax_behavior: "exclusive",
    lookup_key: lookupKey, nickname, metadata: { staypack_plan_id: planId, item: kind }, ...options,
  }, { idempotencyKey: lookupKey });
  assert.equal(result.product, product.id);
  assert.equal(result.active, true);
  return result;
}
const base = await price("base", "Agency base — A$199/month plus GST", { unit_amount: 19900, recurring: { interval: "month" } });
const calculatorPrice = await price("calculator", "100 calculator estimates included; then A$1 each plus GST", {
  billing_scheme: "tiered", tiers_mode: "graduated", tiers: [{ up_to: 100, unit_amount: 0 }, { up_to: "inf", unit_amount: 100 }],
  recurring: { interval: "month", usage_type: "metered", meter: calculator.id } });
const reportPrice = await price("report", "30 reports included; then A$5 each plus GST", {
  billing_scheme: "tiered", tiers_mode: "graduated", tiers: [{ up_to: 30, unit_amount: 0 }, { up_to: "inf", unit_amount: 500 }],
  recurring: { interval: "month", usage_type: "metered", meter: report.id } });
await stripe.products.update(product.id, { default_price: base.id });
const rates = await stripe.taxRates.list({ active: true, limit: 100 }).autoPagingToArray({ limit: 1000 });
const gst = rates.find((rate) => rate.percentage === 10 && rate.country === "AU" && !rate.inclusive && rate.tax_type === "gst")
  ?? await stripe.taxRates.create({ display_name: "GST", description: "Australian GST — 10% added to StayPack agency base fee and overages",
    inclusive: false, percentage: 10, country: "AU", jurisdiction: "Australia", tax_type: "gst",
    metadata: { staypack: "agency-gst-v1" },
  }, { idempotencyKey: "staypack-australian-gst-exclusive-v1" });
const plan = { id: planId, name: "StayPack Agency", currency: "aud", baseCents: 19900,
  includedCalculators: 100, includedReports: 30, calculatorOverageCents: 100, reportOverageCents: 500,
  basePriceId: base.id, calculatorPriceId: calculatorPrice.id, reportPriceId: reportPrice.id,
  calculatorEventName: calculator.event_name, reportEventName: report.event_name, taxBehavior: "exclusive", gstTaxRateId: gst.id };
const replacements = { BILLING_PLANS_JSON: JSON.stringify([plan]), STRIPE_AUTOMATIC_TAX: "false" };
const lines = readFileSync(".env.local", "utf8").split("\n").filter((line) => !(line.split("=", 1)[0] in replacements));
writeFileSync(".env.local", lines.join("\n").trimEnd() + "\n" + Object.entries(replacements).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600 });
const result = { accountId: account.id, livemode: false, productId: product.id, plan, calculatorMeterId: calculator.id, reportMeterId: report.id };
writeFileSync(".codex/billing-agency-catalogue.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
