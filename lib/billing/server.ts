import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingConfig, billingMode } from "./config";
import { billingPlans, billingPlanSchema, type BillingPlan, type UsageKind } from "./plans";
import { billingStripe } from "./stripe";
import { checkoutTaxOptions } from "./tax";

export type BillingAccount = {
  id: string; agency_id: string; livemode: boolean; stripe_customer_id: string | null;
  stripe_subscription_id: string | null; plan: BillingPlan | null; status: string;
  period_start: string | null; period_end: string | null; cancel_at_period_end: boolean;
  metering_enabled: boolean; checkout_attempt: string | null; checkout_expires_at: string | null;
};

export async function readBillingAccount(agencyId: string) {
  const { data, error } = await createAdminClient().from("billing_accounts").select("*")
    .eq("agency_id", agencyId).eq("livemode", billingConfig().livemode).maybeSingle();
  if (error) throw error;
  return data as BillingAccount | null;
}

async function ensureCustomer(agency: { id: string; name: string }) {
  const admin = createAdminClient();
  const { livemode } = billingConfig();
  const { error } = await admin.from("billing_accounts").upsert({ agency_id: agency.id, livemode },
    { onConflict: "agency_id,livemode", ignoreDuplicates: true });
  if (error) throw error;
  const account = (await readBillingAccount(agency.id))!;
  if (!account.stripe_customer_id) {
    const stripe = await billingStripe();
    const customer = await stripe.customers.create({ name: agency.name, metadata: { agency_id: agency.id, billing_account_id: account.id } },
      { idempotencyKey: `staypack-customer-${account.id}` });
    const { error: updateError } = await admin.from("billing_accounts").update({ stripe_customer_id: customer.id }).eq("id", account.id);
    if (updateError) throw updateError;
    account.stripe_customer_id = customer.id;
  }
  return account;
}

export function checkoutLineItems(plan: BillingPlan): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return [{ price: plan.basePriceId, quantity: 1 }, { price: plan.calculatorPriceId }, { price: plan.reportPriceId }];
}

/** Verify catalogue values against Stripe before asking a customer to pay. */
export async function validateStripePlan(stripe: Stripe, plan: BillingPlan) {
  checkoutTaxOptions(plan);
  const ids = [plan.basePriceId, plan.calculatorPriceId, plan.reportPriceId];
  const prices = await Promise.all(ids.map((id) => stripe.prices.retrieve(id, { expand: ["tiers"] })));
  const live = billingConfig().livemode;
  if (plan.gstTaxRateId) {
    const gst = await stripe.taxRates.retrieve(plan.gstTaxRateId);
    if (!gst.active || gst.livemode !== live || gst.inclusive || gst.percentage !== 10 || gst.country !== "AU") {
      throw new Error("Australian GST rate must be active, exclusive and 10%");
    }
  }
  for (const price of prices) {
    if (!price.active || price.livemode !== live || price.currency !== plan.currency || price.tax_behavior !== plan.taxBehavior
      || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.transform_quantity) {
      throw new Error("Stripe price does not match the billing plan");
    }
  }
  if (prices[0].recurring?.usage_type !== "licensed" || prices[0].unit_amount !== plan.baseCents) throw new Error("Base price mismatch");
  for (const [index, allowance, cents, eventName] of [
    [1, plan.includedCalculators, plan.calculatorOverageCents, plan.calculatorEventName],
    [2, plan.includedReports, plan.reportOverageCents, plan.reportEventName],
  ] as const) {
    const price = prices[index];
    if (price.recurring?.usage_type !== "metered" || !price.recurring.meter) throw new Error("Metered price required");
    const meter = await stripe.billing.meters.retrieve(price.recurring.meter);
    if (meter.status !== "active" || meter.event_name !== eventName || meter.default_aggregation.formula !== "sum"
      || meter.customer_mapping.event_payload_key !== "stripe_customer_id" || meter.value_settings.event_payload_key !== "value") throw new Error("Usage meter mismatch");
    const tiers = price.tiers;
    if (allowance === 0) {
      if (price.billing_scheme !== "per_unit" || price.unit_amount !== cents) throw new Error("Overage price mismatch");
    } else if (price.billing_scheme !== "tiered" || price.tiers_mode !== "graduated" || tiers?.length !== 2
      || tiers[0].up_to !== allowance || tiers[0].unit_amount !== 0 || (tiers[0].flat_amount ?? 0) !== 0
      || tiers[1].up_to !== null || tiers[1].unit_amount !== cents || (tiers[1].flat_amount ?? 0) !== 0) {
      throw new Error("Included usage tiers do not match the billing plan");
    }
  }
}

export async function createBillingCheckout(agency: { id: string; name: string }, planId: string) {
  const plan = billingPlans().find((candidate) => candidate.id === planId);
  if (!plan) throw new Error("Unknown billing plan");
  const account = await ensureCustomer(agency);
  const stripe = await billingStripe();
  // Also check Stripe directly: a completed Checkout webhook might not have arrived yet.
  const subscriptions = await stripe.subscriptions.list({ customer: account.stripe_customer_id!, status: "all", limit: 100 });
  if (subscriptions.data.some((sub) => !["canceled", "incomplete_expired"].includes(sub.status))) throw new Error("Use the billing portal for the existing subscription");
  await validateStripePlan(stripe, plan);
  const { data, error } = await createAdminClient().rpc("begin_billing_checkout", { p_account_id: account.id, p_plan: plan });
  if (error) throw error;
  const attempt = data as BillingAccount;
  const { origin } = billingConfig();
  const tax = checkoutTaxOptions(plan);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", managed_payments: { enabled: false }, customer: account.stripe_customer_id!, client_reference_id: agency.id,
    line_items: checkoutLineItems(plan), expires_at: Math.floor(Date.parse(attempt.checkout_expires_at!) / 1000),
    subscription_data: { ...tax.subscription_data, metadata: { agency_id: agency.id, plan_id: plan.id, billing_account_id: account.id } },
    metadata: { agency_id: agency.id, plan_id: plan.id },
    success_url: `${origin}/settings/billing?checkout=complete`, cancel_url: `${origin}/settings/billing`,
    billing_address_collection: "required", customer_update: { address: "auto" },
    automatic_tax: tax.automatic_tax,
  }, { idempotencyKey: `staypack-checkout-${attempt.checkout_attempt}` });
  if (!session.url) throw new Error("Checkout is not available");
  return session.url;
}

export async function createBillingPortal(agencyId: string) {
  const account = await readBillingAccount(agencyId);
  if (!account?.stripe_customer_id) throw new Error("No billing account");
  const stripe = await billingStripe();
  const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (!configuration) throw new Error("Billing portal configuration required");
  return (await stripe.billingPortal.sessions.create({ customer: account.stripe_customer_id,
    configuration, return_url: `${billingConfig().origin}/settings/billing` })).url;
}

export async function recordCompletedCalculator(agencyId: string, resultId: string) {
  if (billingMode() === "disabled") return;
  return recordCompletedUsage(agencyId, "calculator", resultId);
}

async function recordCompletedUsage(agencyId: string, kind: UsageKind, sourceId: string) {
  const { error } = await createAdminClient().rpc("record_billing_usage", {
    p_agency_id: agencyId, p_livemode: billingConfig().livemode, p_kind: kind, p_source_id: sourceId,
  });
  if (error) throw error;
}

export async function usageTotals(account: BillingAccount) {
  if (!account.period_start || !account.period_end) return { calculators: 0, reports: 0, needsReview: 0 };
  const { data, error } = await createAdminClient().rpc("billing_usage_totals", {
    p_account_id: account.id, p_start: account.period_start, p_end: account.period_end,
  });
  if (error) throw error;
  return data as { calculators: number; reports: number; needsReview: number };
}

export async function syncSubscription(account: BillingAccount, eventId: string, subscriptionId: string) {
  const admin = createAdminClient();
  const token = randomUUID();
  const claim = await admin.rpc("claim_billing_sync", { p_account_id: account.id, p_token: token });
  if (claim.error) throw claim.error;
  if (!claim.data) throw new Error("Billing sync busy; retry this webhook");
  try {
    const stripe = await billingStripe();
    const fresh = await admin.from("billing_accounts").select("*").eq("id", account.id).single();
    if (fresh.error) throw fresh.error;
    account = fresh.data as BillingAccount;
    let sub = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    if (customerId !== account.stripe_customer_id || sub.livemode !== account.livemode) throw new Error("Subscription ownership mismatch");
    // Ignore a delayed event for an older canceled subscription after a new one was purchased.
    if (account.stripe_subscription_id && account.stripe_subscription_id !== sub.id) {
      const current = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
      if (current.created > sub.created) sub = current;
      else if (!["canceled", "incomplete_expired"].includes(current.status)) throw new Error("A different subscription is already active");
    }
    const configured = billingPlans().find((plan) => plan.id === sub.metadata.plan_id);
    const plan = (account.plan?.id === sub.metadata.plan_id ? billingPlanSchema.parse(account.plan) : null) ?? configured;
    if (!plan || sub.items.has_more || sub.items.data.length !== 3) throw new Error("Unknown subscription plan");
    if (plan.gstTaxRateId && (sub.automatic_tax.enabled || sub.default_tax_rates?.length !== 1
      || sub.default_tax_rates[0].id !== plan.gstTaxRateId || sub.items.data.some((item) => item.tax_rates?.length))) {
      throw new Error("Subscription GST changed unexpectedly");
    }
    const expected = new Set([plan.basePriceId, plan.calculatorPriceId, plan.reportPriceId]);
    if (sub.items.data.some((item) => !expected.delete(item.price.id)) || expected.size) throw new Error("Subscription prices changed unexpectedly");
    const base = sub.items.data.find((item) => item.price.id === plan.basePriceId)!;
    if (base.quantity !== 1 || sub.items.data.some((item) => item.current_period_start !== base.current_period_start || item.current_period_end !== base.current_period_end)) {
      throw new Error("Unexpected subscription quantity or billing periods");
    }
    const result = await admin.rpc("finish_billing_sync", {
      p_account_id: account.id, p_token: token, p_event_id: eventId, p_subscription_id: sub.id,
      p_status: sub.status, p_plan: plan, p_period_start: new Date(base.current_period_start * 1000).toISOString(),
      p_period_end: new Date(base.current_period_end * 1000).toISOString(), p_cancel: sub.cancel_at_period_end,
    });
    if (result.error) throw result.error;
  } finally {
    await admin.from("billing_accounts").update({ sync_token: null, sync_expires_at: null }).eq("id", account.id).eq("sync_token", token);
  }
}
