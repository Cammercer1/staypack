import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingConfig } from "./config";
import { billingStripe } from "./stripe";

export type QueuedUsage = {
  id: string; event_name: string; stripe_customer_id: string; quantity: number;
  occurred_at: string; first_attempt_at: string;
};

export function meterEventParams(event: QueuedUsage): Stripe.Billing.MeterEventCreateParams {
  return { identifier: event.id, event_name: event.event_name,
    timestamp: Math.floor(Date.parse(event.occurred_at) / 1000),
    payload: { stripe_customer_id: event.stripe_customer_id, value: String(event.quantity) } };
}

export function requiresUsageReview(event: QueuedUsage, now = Date.now()) {
  // Stripe's idempotency/deduplication windows are limited. An uncertain old send
  // must be reconciled, never blindly sent again after the deduplication window.
  return now - Date.parse(event.first_attempt_at) >= 23 * 60 * 60 * 1000
    || now - Date.parse(event.occurred_at) >= 34 * 24 * 60 * 60 * 1000;
}

export async function dispatchUsage() {
  const admin = createAdminClient();
  const stripe = await billingStripe();
  const token = randomUUID();
  const { data, error } = await admin.rpc("claim_billing_usage", { p_livemode: billingConfig().livemode, p_token: token });
  if (error) throw error;
  const result = { accepted: 0, retrying: 0, needsReview: 0 };
  const deadline = Date.now() + 15_000;
  for (const event of (data ?? []) as QueuedUsage[]) {
    let state: "accepted" | "pending" | "needs_review" = "pending";
    let lastError: string | null = null;
    if (requiresUsageReview(event)) {
      state = "needs_review";
      lastError = "Reconcile in Stripe before retrying old usage.";
      result.needsReview++;
    } else if (Date.now() < deadline) {
      try {
        await stripe.billing.meterEvents.create(meterEventParams(event), { idempotencyKey: `staypack-usage-${event.id}`, timeout: 5_000, maxNetworkRetries: 0 });
        state = "accepted";
        result.accepted++;
      } catch {
        result.retrying++;
        lastError = "Stripe did not confirm usage receipt. Retry with the same identifier.";
      }
    } else {
      result.retrying++;
    }
    const saved = await admin.from("billing_usage_events").update({ state, last_error: lastError,
      accepted_at: state === "accepted" ? new Date().toISOString() : null, lease_token: null, lease_expires_at: null,
    }).eq("id", event.id).eq("lease_token", token);
    if (saved.error) throw saved.error;
  }
  return result;
}
