import { describe, expect, it } from "vitest";
import { billingPlans, estimateBill } from "./plans";
import { checkoutTaxOptions } from "./tax";

const plan = billingPlans(JSON.stringify([{ id: "agency-monthly-v1", name: "StayPack Agency", currency: "aud",
  baseCents: 19900, includedCalculators: 100, includedReports: 30, calculatorOverageCents: 100, reportOverageCents: 500,
  basePriceId: "price_base", calculatorPriceId: "price_calc", reportPriceId: "price_report",
  calculatorEventName: "staypack_calculator_v1", reportEventName: "staypack_report_v1",
  taxBehavior: "exclusive", gstTaxRateId: "txr_gst" }]))[0];

describe("agency plan plus GST", () => {
  it("applies GST to the whole subscription, including future metered invoices", () => {
    expect(checkoutTaxOptions(plan, false)).toEqual({ automatic_tax: { enabled: false }, subscription_data: { default_tax_rates: ["txr_gst"] } });
    expect(estimateBill(plan, { calculators: 100, reports: 30 }).totalCents).toBe(19900);
    expect(estimateBill(plan, { calculators: 105, reports: 35 }).totalCents).toBe(22900);
  });
  it("rejects ambiguous tax configuration", () => {
    expect(() => checkoutTaxOptions(plan, true)).toThrow("not both");
    expect(() => billingPlans(JSON.stringify([{ ...plan, taxBehavior: "inclusive" }]))).toThrow("GST");
  });
  it("preserves plans without fixed GST", () => {
    expect(checkoutTaxOptions({ ...plan, gstTaxRateId: undefined }, true)).toEqual({ automatic_tax: { enabled: true }, subscription_data: {} });
  });
});
