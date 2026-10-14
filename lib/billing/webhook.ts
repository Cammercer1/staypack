import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingConfig } from "./config";
import { type BillingAccount, syncSubscription } from "./server";

const subscriptionEvents = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"]);

export async function processBillingWebhook(event: Stripe.Event) {
  if (event.livemode !== billingConfig().livemode) throw new Error("Webhook environment mismatch");
  let customerId: string | null = null;
  let subscriptionId: string | null = null;
  if (subscriptionEvents.has(event.type)) {
    const sub = event.data.object as Stripe.Subscription;
    customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    subscriptionId = sub.id;
  } else if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode !== "subscription") return;
    customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  } else if (["invoice.paid", "invoice.payment_failed", "invoice.created"].includes(event.type)) {
    const invoice = event.data.object as Stripe.Invoice;
    customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
    const sub = invoice.parent?.subscription_details?.subscription;
    subscriptionId = typeof sub === "string" ? sub : sub?.id ?? null;
    // A non-2xx response delays automatic finalization while unsent usage is repaired.
    // This is a backstop; the scheduled dispatcher must normally drain usage promptly.
    if (event.type === "invoice.created" && invoice.billing_reason === "subscription_cycle" && customerId) {
      const { count, error } = await createAdminClient().from("billing_usage_events").select("id", { count: "exact", head: true })
        .eq("stripe_customer_id", customerId).eq("stripe_subscription_id", subscriptionId ?? "")
        .neq("state", "accepted").lt("occurred_at", new Date(invoice.period_end * 1000).toISOString());
      if (error) throw error;
      if (count) throw new Error("Unsent usage requires reconciliation before invoice finalization");
    }
  } else return;
  if (!customerId || !subscriptionId) return;
  const admin = createAdminClient();
  const processed = await admin.from("billing_webhook_events").select("stripe_event_id").eq("stripe_event_id", event.id).maybeSingle();
  if (processed.error) throw processed.error;
  if (processed.data) return;
  const { data, error } = await admin.from("billing_accounts").select("*").eq("stripe_customer_id", customerId).eq("livemode", event.livemode).maybeSingle();
  if (error) throw error;
  if (!data) return; // Other manually managed customers in the Stripe account are outside this integration.
  await syncSubscription(data as BillingAccount, event.id, subscriptionId);
}
