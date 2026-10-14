import { describe, expect, it } from "vitest";
import { createProposalFixture } from "./fixtures";
import { proposalDataSchema, proposalFromReport } from "./data";
import { CALENDAR_MONTHS, monthlyRevenueProjection, seasonalProfileFromReport } from "./seasonality";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";
import { proposalSnapshotSchema } from "./workspace";
import { BRAND_DEFAULTS } from "./brand";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";

const rows = () => CALENDAR_MONTHS.map((month, index) => ({ month, revenue: (index + 1) * 100, revenue_low: null, revenue_high: null, occupancy: null, adr: null }));

describe("seasonal revenue projection", () => {
  it("maps out-of-order historical month keys back to Jan–Dec and normalises their shares", () => {
    const source = rows().map((row, index) => ({ ...row, month: `2025-${String(index + 1).padStart(2, "0")}` })).reverse();
    const profile = seasonalProfileFromReport(source)!;
    expect(profile.weights[0]).toBeCloseTo(100 / 7800);
    expect(profile.weights[11]).toBeCloseTo(1200 / 7800);
    expect(profile.weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });
  it("does not fabricate a seasonal pattern from incomplete, duplicate, invalid or all-zero months", () => {
    const valid = rows();
    for (const source of [undefined, [], valid.slice(1), [...valid.slice(1), valid[1]], valid.map(row => ({ ...row, revenue: 0 })),
      valid.map((row, index) => index ? row : { ...row, revenue: null }),
      valid.map((row, index) => index ? row : { ...row, revenue: -1 }),
      valid.map((row, index) => index ? row : { ...row, month: "2025-13" })]) expect(seasonalProfileFromReport(source)).toBeNull();
  });
  it("reconciles each rounded monthly series to the separate annual estimate", () => {
    const data = createProposalFixture();
    data.ltr.annualRent = 58500; data.str.market.annualRevenue = 68351; data.str.managed.annualRevenue = 78604;
    const months = monthlyRevenueProjection(data)!;
    expect(months.every(month => month.ltr === 4875)).toBe(true);
    for (const [key, annual] of [["ltr", 58500], ["market", 68351], ["managed", 78604]] as const) {
      expect(months.reduce((sum, month) => sum + month[key]!, 0)).toBe(annual);
      expect(months.every(month => Number.isInteger(month[key]) && month[key]! >= 0)).toBe(true);
    }
    expect(months[11].managed).toBeGreaterThan(months[5].managed!);
  });
  it("preserves missing scenarios and genuine zeros, including months with no estimated revenue", () => {
    const data = createProposalFixture();
    data.seasonality!.weights = [1, ...Array(11).fill(0)];
    data.ltr.annualRent = null; data.str.managed.annualRevenue = 0;
    const months = monthlyRevenueProjection(data)!;
    expect(months.every(month => month.ltr === null && month.managed === 0)).toBe(true);
    expect(months[0].market).toBe(data.str.market.annualRevenue);
    expect(months.slice(1).every(month => month.market === 0)).toBe(true);
    data.str.managed.annualRevenue = null;
    expect(monthlyRevenueProjection(data)!.every(month => month.managed === null)).toBe(true);
  });
  it("keeps rounding differences at most a dollar per month", () => {
    const data = createProposalFixture(); data.ltr.annualRent = 1001;
    const values = monthlyRevenueProjection(data)!.map(month => month.ltr!);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(1001);
    expect(Math.max(...values) - Math.min(...values)).toBe(1);
  });
  it("leaves older published snapshots readable without inventing seasonal data", () => {
    const data = { ...createProposalFixture(), seasonality: undefined };
    const parsed = proposalSnapshotSchema.parse({ version: 1, data, brand: BRAND_DEFAULTS, draft: DEFAULT_PROPOSAL_DRAFT, attachments: [] });
    expect(parsed.data.seasonality).toBeNull();
    expect(monthlyRevenueProjection(parsed.data)).toBeNull();
    expect(proposalDataSchema.safeParse({ ...data, seasonality: { basis: "seasonal_projection", weights: Array(12).fill(0.5) } }).success).toBe(false);
  });
  it("copies the saved seasonal shape into the public snapshot and keeps both annual scenarios separate", () => {
    const report = getStrPlaygroundReport();
    report.str_enrichment = { tier: "full", comp_count: 0, radius_m: null, revenue_range: null, comps: [], seasonality: rows() };
    report.str_scenario = { basis: "management", market_benchmark: { annual_revenue: 68351, nightly_rate: 300, occupancy_rate: 0.7 } };
    report.str.annual_revenue = 78604;
    const frozen = proposalSnapshotSchema.parse({ version: 1, data: proposalFromReport(report), brand: BRAND_DEFAULTS, draft: DEFAULT_PROPOSAL_DRAFT, attachments: [] });
    const before = monthlyRevenueProjection(frozen.data);
    report.str_enrichment.seasonality[0].revenue = 999999;
    report.str.annual_revenue = 1;
    expect(monthlyRevenueProjection(frozen.data)).toEqual(before);
    expect(before!.reduce((sum, month) => sum + month.managed!, 0)).toBe(78604);
    expect(before!.reduce((sum, month) => sum + month.market!, 0)).toBe(68351);
  });
});
