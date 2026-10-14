import { z } from "zod";

const count = z.number().int().nonnegative().max(1_000_000);
const priceId = z.string().regex(/^price_[A-Za-z0-9]+$/);
export const billingPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  name: z.string().min(1).max(100),
  currency: z.literal("aud"),
  baseCents: count,
  includedCalculators: count,
  includedReports: count,
  calculatorOverageCents: count,
  reportOverageCents: count,
  basePriceId: priceId,
  calculatorPriceId: priceId,
  reportPriceId: priceId,
  calculatorEventName: z.string().regex(/^[a-z0-9_]+$/),
  reportEventName: z.string().regex(/^[a-z0-9_]+$/),
  taxBehavior: z.enum(["inclusive", "exclusive"]),
  gstTaxRateId: z.string().regex(/^txr_[A-Za-z0-9]+$/).optional(),
}).strict().refine((plan) => new Set([plan.basePriceId, plan.calculatorPriceId, plan.reportPriceId]).size === 3,
  "Each subscription item needs a different Stripe price.")
  .refine((plan) => !plan.gstTaxRateId || plan.taxBehavior === "exclusive", "GST must be added to tax-exclusive prices.");
export type BillingPlan = z.infer<typeof billingPlanSchema>;
export type UsageKind = "calculator" | "report";

/** Server-owned, versioned catalogue. Never accept prices or allowances from a browser. */
export function billingPlans(raw = process.env.BILLING_PLANS_JSON ?? "[]"): BillingPlan[] {
  const plans = z.array(billingPlanSchema).parse(JSON.parse(raw));
  if (new Set(plans.map((plan) => plan.id)).size !== plans.length) throw new Error("Duplicate billing plan ID");
  return plans;
}

export function estimateBill(plan: BillingPlan, usage: { calculators: number; reports: number }) {
  const calculators = count.parse(usage.calculators);
  const reports = count.parse(usage.reports);
  const calculatorOverage = Math.max(0, calculators - plan.includedCalculators);
  const reportOverage = Math.max(0, reports - plan.includedReports);
  const overageCents = calculatorOverage * plan.calculatorOverageCents + reportOverage * plan.reportOverageCents;
  return { calculatorOverage, reportOverage, overageCents, totalCents: plan.baseCents + overageCents };
}

export function formatBillingMoney(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}
