import { describe, expect, it } from "vitest";
import { billingPlans, estimateBill } from "./plans";

export const samplePlan = { id: "test-v1", name: "Test", currency: "aud", baseCents: 10000,
  includedCalculators: 100, includedReports: 10, calculatorOverageCents: 100, reportOverageCents: 500,
  basePriceId: "price_base", calculatorPriceId: "price_calculator", reportPriceId: "price_report",
  calculatorEventName: "staypack_calculator_v1", reportEventName: "staypack_report_v1", taxBehavior: "exclusive" } as const;

describe("agency base fee and usage", () => {
  it("charges only the base at or below both allowances", () => {
    expect(estimateBill(samplePlan, { calculators: 100, reports: 10 })).toEqual({ calculatorOverage: 0, reportOverage: 0, overageCents: 0, totalCents: 10000 });
  });
  it("rates independent overages in integer cents", () => {
    expect(estimateBill(samplePlan, { calculators: 103, reports: 12 })).toEqual({ calculatorOverage: 3, reportOverage: 2, overageCents: 1300, totalCents: 11300 });
  });
  it("supports zero allowances", () => {
    expect(estimateBill({ ...samplePlan, includedReports: 0 }, { calculators: 0, reports: 1 }).overageCents).toBe(500);
  });
  it("rejects negative or fractional usage and duplicate plans", () => {
    expect(() => estimateBill(samplePlan, { calculators: -1, reports: 0 })).toThrow();
    expect(() => estimateBill(samplePlan, { calculators: 0, reports: 0.5 })).toThrow();
    expect(() => billingPlans(JSON.stringify([samplePlan, samplePlan]))).toThrow("Duplicate");
  });
  it("rejects arbitrary prices, duplicate line items and unrecognized fields", () => {
    expect(() => billingPlans(JSON.stringify([{ ...samplePlan, basePriceId: "client-amount" }]))).toThrow();
    expect(() => billingPlans(JSON.stringify([{ ...samplePlan, reportPriceId: samplePlan.basePriceId }]))).toThrow();
    expect(() => billingPlans(JSON.stringify([{ ...samplePlan, discount: 100 }]))).toThrow();
  });
});
