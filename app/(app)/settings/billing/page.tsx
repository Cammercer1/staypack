import { PageHeader } from "@/components/app-shell/PageHeader";
import { BillingAction } from "@/components/billing/BillingAction";
import { requireAgency } from "@/lib/auth/requireUser";
import { billingMode } from "@/lib/billing/config";
import { billingPlans, estimateBill, formatBillingMoney as money } from "@/lib/billing/plans";
import { readBillingAccount, usageTotals } from "@/lib/billing/server";

export default async function BillingPage() {
  const { agency, role } = await requireAgency();
  if (!["owner", "admin"].includes(role)) return <PageHeader highlight="Billing" title="access." description="Ask your agency owner or admin to manage your subscription." />;
  const mode = billingMode();
  if (mode === "disabled") return <div className="space-y-8">
    <PageHeader highlight="Agency" title="billing." description="One subscription shared by your whole team." />
    <div className="rounded-2xl border bg-base-100 p-6 space-y-3">
      <h2 className="text-xl font-semibold">Billing is being set up</h2>
      <p>Your plan will include a monthly base fee, calculator estimates and reports. Any usage above your included allowance will be itemised on your monthly invoice.</p>
      <p className="text-sm text-base-content/60">Pricing will be shown here before you subscribe.</p>
    </div>
  </div>;
  const account = await readBillingAccount(agency.id);
  const usage = account ? await usageTotals(account) : { calculators: 0, reports: 0, needsReview: 0 };
  const plan = account?.plan;
  const bill = plan ? estimateBill(plan, usage) : null;
  const subscribed = account?.stripe_subscription_id && !["canceled", "incomplete_expired"].includes(account.status);
  return <div className="space-y-8">
    <PageHeader highlight="Agency" title="billing." description="Manage your shared subscription, usage and invoices." />
    {mode === "test" && <p className="rounded-xl bg-warning/15 p-4 text-sm">Sandbox billing — no real payments are collected.</p>}
    {subscribed && plan && bill ? <>
      <section className="rounded-2xl border bg-base-100 p-6 space-y-4">
        <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-xl font-semibold">{plan.name}</h2><p>{money(plan.baseCents)} / month · {account.status.replaceAll("_", " ")}</p></div><BillingAction>Manage billing & invoices</BillingAction></div>
        {account.period_start && account.period_end && <p className="text-sm text-base-content/60">Billing period: {new Date(account.period_start).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })} – {new Date(account.period_end).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}</p>}
        {account.cancel_at_period_end && <p>Your subscription is set to end at the end of this billing period.</p>}
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        {[{ title: "Calculator estimates", used: usage.calculators, included: plan.includedCalculators, rate: plan.calculatorOverageCents },
          { title: "Reports", used: usage.reports, included: plan.includedReports, rate: plan.reportOverageCents }].map((item) => <div key={item.title} className="rounded-2xl border p-6 space-y-2">
          <h2 className="font-semibold">{item.title}</h2><p className="text-3xl font-semibold">{item.used} <span className="text-sm font-normal text-base-content/60">/ {item.included} included</span></p>
          <p className="text-sm">{money(item.rate)} per additional {item.title === "Reports" ? "report" : "estimate"}</p>
        </div>)}
      </section>
      <section className="rounded-2xl border p-6 space-y-2"><h2 className="font-semibold">Estimated usage charges this period</h2><p className="text-3xl font-semibold">{money(bill.overageCents)}</p><p className="text-sm text-base-content/60">In addition to your monthly base fee. {plan.gstTaxRateId ? "All prices exclude 10% GST, which is added to your invoice." : `Prices are tax ${plan.taxBehavior}; any applicable adjustments appear on your invoice.`}</p></section>
    </> : <section className="grid gap-5 md:grid-cols-2">{billingPlans().map((option) => <div key={option.id} className="rounded-2xl border p-6 space-y-4"><h2 className="text-xl font-semibold">{option.name}</h2><p className="text-3xl font-semibold">{money(option.baseCents)}<span className="text-sm font-normal"> / month</span></p><p>{option.includedCalculators} calculator estimates and {option.includedReports} reports included.</p><p className="text-sm">Then {money(option.calculatorOverageCents)} per extra calculator estimate and {money(option.reportOverageCents)} per extra report. {option.gstTaxRateId ? "All prices plus 10% GST." : `Tax ${option.taxBehavior}.`}</p><BillingAction planId={option.id}>Choose plan</BillingAction></div>)}</section>}
    <p className="text-sm text-base-content/60">A report counts once, when first published. Edits, repeat downloads and retries are included. Calculator usage counts completed standalone estimates.</p>
  </div>;
}
