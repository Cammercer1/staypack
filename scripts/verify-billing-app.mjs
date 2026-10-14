// Explicit sandbox integration check: temporary agencies/users are removed in finally.
// Requires the local app in test mode and Stripe CLI forwarding real signed webhooks.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import Stripe from "stripe";

const env = parseEnv(readFileSync(".env.local", "utf8"));
assert.equal(process.env.BILLING_APP_INTEGRATION, "1", "Explicit integration-test opt-in required");
assert.equal(env.BILLING_MODE, "test");
assert.ok(env.STRIPE_SECRET_KEY?.startsWith("sk_test_"));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "https://qmtfugaeujeikyegoxwi.supabase.co");
const origin = "http://localhost:3000";
assert.equal(env.BILLING_SITE_URL, origin);
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-09-30.endive" });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const plan = JSON.parse(env.BILLING_PLANS_JSON).find(p => p.id === "sandbox-verification-v1");
assert.ok(plan);
const run = randomUUID();
const agencyId = randomUUID();
const otherAgencyId = randomUUID();
const fixtures = [];
const evidence = { run, agencyId, startedAt: new Date().toISOString(), checks: [] };
let customerId;
let subscriptionId;
let accountId;
let checkoutId;
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
function passed(name) { evidence.checks.push(name); console.log(`PASS ${name}`); }
async function eventually(name, read, predicate, timeout = 60_000) {
  const end = Date.now() + timeout;
  do { const value = await read(); if (predicate(value)) return value; await delay(1500); } while (Date.now() < end);
  throw new Error(`Timed out: ${name}`);
}
async function identity(id, label) {
  const email = `billing-${label}-${run}@example.com`;
  const password = `${randomUUID()}Aa!1`;
  const { user } = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  const fixture = { userId: user.id, agencyId: id };
  fixtures.push(fixture);
  checked(await admin.from("agencies").insert({ id, name: `Billing integration ${label}`, slug: `billing-${label}-${run}` }));
  checked(await admin.from("agency_members").insert({ agency_id: id, user_id: user.id, role: "owner" }));
  const cookies = [];
  fixture.auth = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookies, setAll: values => cookies.splice(0, cookies.length, ...values) },
  });
  const session = checked(await fixture.auth.auth.signInWithPassword({ email, password }));
  fixture.accessToken = session.session.access_token;
  fixture.cookie = cookies.map(c => `${c.name}=${c.value}`).join("; ");
  return fixture;
}
async function post(path, identity, body = {}) {
  return fetch(`${origin}${path}`, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(60_000),
    headers: { cookie: identity.cookie, origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
const readAccount = async () => checked(await admin.from("billing_accounts").select("*").eq("agency_id", agencyId).eq("livemode", false).single());
try {
  assert.equal((await stripe.accounts.retrieve(env.STRIPE_ACCOUNT_ID)).id, env.STRIPE_ACCOUNT_ID);
  const owner = await identity(agencyId, "owner");
  const outsider = await identity(otherAgencyId, "other");
  const page = await fetch(`${origin}/settings/billing`, { headers: { cookie: owner.cookie } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Sandbox billing/);
  passed("Authenticated billing page renders with sandbox notice");
  const first = await post("/api/billing/checkout", owner, { planId: plan.id });
  assert.equal(first.status, 200, await first.clone().text());
  const firstUrl = (await first.json()).url;
  const second = await post("/api/billing/checkout", owner, { planId: plan.id });
  assert.equal((await second.json()).url, firstUrl);
  let account = await readAccount();
  accountId = account.id; customerId = account.stripe_customer_id;
  const sessions = await stripe.checkout.sessions.list({ customer: customerId });
  assert.equal(sessions.data.length, 1);
  checkoutId = sessions.data[0].id;
  assert.equal(sessions.data[0].client_reference_id, agencyId);
  passed("Repeated Checkout requests reuse one agency-owned session");
  assert.equal(checked(await outsider.auth.from("billing_accounts").select("id").eq("id", accountId)).length, 0);
  assert.ok((await owner.auth.rpc("record_billing_usage", { p_agency_id: agencyId, p_livemode: false, p_kind: "calculator", p_source_id: run })).error);
  checked(await admin.from("agency_members").update({ role: "member" }).eq("agency_id", agencyId).eq("user_id", owner.userId));
  assert.equal(checked(await owner.auth.from("billing_accounts").select("id").eq("id", accountId)).length, 0);
  assert.ok((await post("/api/billing/portal", owner)).status >= 400);
  checked(await admin.from("agency_members").update({ role: "owner" }).eq("agency_id", agencyId).eq("user_id", owner.userId));
  passed("Other agencies and ordinary members cannot access billing; clients cannot forge usage");
  await stripe.checkout.sessions.expire(checkoutId);
  const paymentMethod = await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethod.id } });
  const sub = await stripe.subscriptions.create({ customer: customerId, default_payment_method: paymentMethod.id,
    items: [{ price: plan.basePriceId }, { price: plan.calculatorPriceId }, { price: plan.reportPriceId }],
    metadata: { agency_id: agencyId, billing_account_id: accountId, plan_id: plan.id, purpose: "billing_app_verification", run } });
  subscriptionId = sub.id;
  const baseInvoice = await stripe.invoices.retrieve(sub.latest_invoice);
  assert.equal(baseInvoice.amount_paid, plan.baseCents);
  account = await eventually("real webhook enables billing", readAccount, a => a.status === "active" && a.metering_enabled);
  passed("Real signed Stripe webhook activates the agency after the base payment");
  const processed = checked(await admin.from("billing_webhook_events").select("stripe_event_id").eq("billing_account_id", accountId));
  const event = await stripe.events.retrieve(processed[0].stripe_event_id);
  const payload = JSON.stringify(event);
  for (let i = 0; i < 2; i++) {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
    assert.equal((await fetch(`${origin}/api/billing/webhook`, { method: "POST", headers: { "stripe-signature": signature }, body: payload })).status, 200);
  }
  assert.equal((await fetch(`${origin}/api/billing/webhook`, { method: "POST", body: payload })).status, 400);
  const repeated = checked(await admin.from("billing_webhook_events").select("stripe_event_id").eq("stripe_event_id", event.id));
  assert.equal(repeated.length, 1);
  passed("Duplicate webhooks are idempotent and invalid signatures are rejected");
  const listingId = randomUUID();
  checked(await admin.from("listings").insert({ id: listingId, agency_id: agencyId, created_by: owner.userId,
    property_address: "Billing integration fixture", public_slug: `billing-${run}` }));
  const reports = Array.from({ length: 12 }, () => ({ id: randomUUID(), agency_id: agencyId, listing_id: listingId, created_by: owner.userId, status: "draft" }));
  checked(await admin.from("reports").insert(reports));
  // Exercise both publication paths, then repeat each publication.
  const legacyIds = reports.slice(0, 6).map(r => r.id);
  checked(await owner.auth.from("reports").update({ status: "published", published_at: new Date().toISOString() }).in("id", legacyIds));
  checked(await owner.auth.from("reports").update({ status: "published" }).in("id", legacyIds));
  for (const revision of [1, 2]) checked(await admin.from("digital_proposal_versions").insert(reports.slice(6).map(r => ({
    report_id: r.id, agency_id: agencyId, draft_revision: revision, share_token: randomBytes(32).toString("hex"), final_report_json: { test: true }, revoked_at: new Date().toISOString(),
  }))));
  for (let start = 0; start < 105; start += 5) await Promise.all(Array.from({ length: Math.min(5, 105 - start) }, async (_, offset) => {
    const args = { p_agency_id: agencyId, p_livemode: false, p_kind: "calculator", p_source_id: `${run}-calculator-${start + offset}` };
    checked(await admin.rpc("record_billing_usage", args));
    checked(await admin.rpc("record_billing_usage", args));
  }));
  const totalArgs = { p_account_id: accountId, p_start: account.period_start, p_end: account.period_end };
  assert.deepEqual(checked(await admin.rpc("billing_usage_totals", totalArgs)), { calculators: 105, reports: 12, needsReview: 0 });
  passed("Calculator retries and repeat report publications do not duplicate the 117 usage events");
  assert.equal((await fetch(`${origin}/api/billing/usage-sync`, { method: "POST" })).status, 401);
  let accepted = 0;
  while (accepted < 117) {
    const response = await fetch(`${origin}/api/billing/usage-sync`, { method: "POST", headers: { authorization: `Bearer ${env.BILLING_CRON_SECRET}` } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.needsReview, 0);
    assert.ok(result.accepted > 0, "Queue made no progress");
    accepted += result.accepted;
  }
  const preview = await eventually("Stripe usage aggregation", () => stripe.invoices.createPreview({ subscription: subscriptionId }), i => i.amount_due === 11500, 120_000);
  evidence.invoiceCents = preview.amount_due;
  passed("Supabase usage reaches Stripe and produces A$100 base + A$15 overage");
  const portal = await post("/api/billing/portal", owner);
  assert.equal(portal.status, 200);
  assert.match((await portal.json()).url, /^https:\/\/billing\.stripe\.com\//);
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  await eventually("scheduled cancellation webhook", readAccount, a => a.cancel_at_period_end);
  await stripe.subscriptions.cancel(subscriptionId, { prorate: false, invoice_now: false });
  await eventually("cancellation webhook", readAccount, a => a.status === "canceled" && !a.metering_enabled);
  checked(await admin.rpc("record_billing_usage", { p_agency_id: agencyId, p_livemode: false, p_kind: "calculator", p_source_id: `${run}-after-cancellation` }));
  assert.deepEqual(checked(await admin.rpc("billing_usage_totals", totalArgs)), { calculators: 105, reports: 12, needsReview: 0 });
  passed("Portal creation, period-end cancellation and canceled-account metering behave correctly");
  evidence.status = "passed";
} catch (error) {
  evidence.status = "failed"; evidence.error = error.message; process.exitCode = 1; console.error(error.message);
} finally {
  // Restrict cleanup to UUIDs created by this run. Never delete existing agency data.
  try {
    if (subscriptionId) { const sub = await stripe.subscriptions.retrieve(subscriptionId); if (sub.status !== "canceled") await stripe.subscriptions.cancel(subscriptionId, { prorate: false, invoice_now: false }); }
    if (checkoutId) { const session = await stripe.checkout.sessions.retrieve(checkoutId); if (session.status === "open") await stripe.checkout.sessions.expire(checkoutId); }
    if (customerId) await stripe.customers.del(customerId);
    if (accountId) {
      checked(await admin.from("billing_webhook_events").delete().eq("billing_account_id", accountId));
      checked(await admin.from("billing_usage_events").delete().eq("billing_account_id", accountId));
      checked(await admin.from("billing_accounts").delete().eq("id", accountId));
    }
    for (const fixture of fixtures) {
      if (fixture.accessToken) checked(await admin.auth.admin.signOut(fixture.accessToken, "global"));
      checked(await admin.from("agencies").delete().eq("id", fixture.agencyId));
      checked(await admin.auth.admin.deleteUser(fixture.userId));
    }
    evidence.cleanedUp = true;
  } catch (error) { evidence.cleanupError = error.message; process.exitCode = 1; console.error(`Cleanup requires attention: ${error.message}`); }
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(".codex/billing-app-verification.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
}
