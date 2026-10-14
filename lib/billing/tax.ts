import type Stripe from "stripe";
import type { BillingPlan } from "./plans";

/** Fixed Australian GST for the agency plan, including its metered overages. */
export function checkoutTaxOptions(plan: BillingPlan, automaticTax = process.env.STRIPE_AUTOMATIC_TAX === "true") {
  if (plan.gstTaxRateId && automaticTax) throw new Error("Choose fixed GST or Automatic Tax, not both");
  return {
    automatic_tax: { enabled: automaticTax },
    subscription_data: plan.gstTaxRateId ? { default_tax_rates: [plan.gstTaxRateId] } : {},
  } satisfies Pick<Stripe.Checkout.SessionCreateParams, "automatic_tax" | "subscription_data">;
}
