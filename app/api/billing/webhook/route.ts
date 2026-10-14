import Stripe from "stripe";
import { billingConfig, billingMode } from "@/lib/billing/config";
import { billingJson } from "@/lib/billing/http";
import { STRIPE_API_VERSION } from "@/lib/billing/stripe";
import { processBillingWebhook } from "@/lib/billing/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (billingMode() === "disabled") return billingJson({ error: "Billing disabled" }, 503);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return billingJson({ error: "Webhook not configured" }, 503);
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(billingConfig().secretKey, { apiVersion: STRIPE_API_VERSION });
    // Stripe signatures require the exact raw body, before JSON parsing.
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch { return billingJson({ error: "Invalid webhook signature" }, 400); }
  try {
    await processBillingWebhook(event);
    return billingJson({ received: true });
  } catch {
    console.error("Stripe webhook requires retry", { eventId: event.id, type: event.type });
    return billingJson({ error: "Webhook processing failed; retry required" }, 500);
  }
}
