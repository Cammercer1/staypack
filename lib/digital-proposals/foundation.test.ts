import { describe, expect, it } from "vitest";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";
import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { comparablesByEstimate, comparisonRows, proposalDataSchema, proposalFromReport } from "./data";
import { BRAND_DEFAULTS, BRAND_PRESETS, brandFromReport, brandOverridesSchema, contrastRatio, resetBrandOverride, resolveProposalBrand } from "./brand";
import { createProposalFixture } from "./fixtures";
import { readToken, resolveTokenText } from "./tokens";
import { DEFAULT_PROPOSAL_DRAFT, validateProposalDraft } from "./template";

describe("digital proposal data", () => {
  it("orders comparables by proximity to the managed estimate, preserves ties, and puts missing revenue last", () => {
    const data = createProposalFixture();
    data.str = { market: { annualRevenue: 60000 }, managed: { annualRevenue: 76000 } };
    data.comparables = [null, 60000, 78000, 74000, 76000, null].map((annualRevenue, index) => ({
      name: `Listing ${index}`, imageUrl: "", bedrooms: 2, distanceM: 100, annualRevenue,
    }));
    const original = structuredClone(data.comparables);
    expect(comparablesByEstimate(data).map(comp => comp.name)).toEqual(["Listing 4", "Listing 2", "Listing 3", "Listing 1", "Listing 0", "Listing 5"]);
    expect(data.comparables).toEqual(original);
    data.str.managed.annualRevenue = null;
    expect(comparablesByEstimate(data)[0].annualRevenue).toBe(60000);
    data.str.market.annualRevenue = null;
    expect(comparablesByEstimate(data)).toEqual(original);
    data.str.managed.annualRevenue = 0;
    expect(comparablesByEstimate(data)[0].annualRevenue).toBe(60000);
  });
  it("uses the frozen market benchmark separately from a managed scenario", () => {
    const report = getStrPlaygroundReport();
    report.str_scenario = { basis: "management", market_benchmark: { annual_revenue: 80000, nightly_rate: 300, occupancy_rate: 0.7 } };
    report.str.annual_revenue = 96000;
    report.property.estimated_value = 1000000;
    report.ltr.weekly_midpoint = 1000;
    const result = proposalFromReport(report, " Jordan ");
    expect(result.recipient).toEqual({ displayName: "Jordan" });
    expect(comparisonRows(result, "annual").map(r => r.value)).toEqual([52000, 80000, 96000]);
    expect(comparisonRows(result, "monthly").map(r => r.value)).toEqual([52000 / 12, 80000 / 12, 8000]);
    expect(comparisonRows(result, "yield").map(r => r.value)).toEqual([5.2, 8, 9.6]);
    report.str.annual_revenue = 1;
    expect(result.str.managed.annualRevenue).toBe(96000);
  });
  it("does not use an advertised price for yield or invent a managed estimate", () => {
    const report = getStrPlaygroundReport();
    report.property.display_price = "$1,250,000";
    const result = proposalFromReport(report);
    expect(result.property.estimatedValue).toBeNull();
    expect(result.str.managed.annualRevenue).toBeNull();
    expect(comparisonRows(result, "yield").every(r => r.value === null)).toBe(true);
  });
  it("keeps a missing original market estimate missing for adjusted reports", () => {
    const report = getStrPlaygroundReport();
    report.str_scenario = { basis: "adjusted", market_benchmark: { annual_revenue: null, nightly_rate: null, occupancy_rate: null } };
    expect(proposalFromReport(report).str).toEqual({ market: { annualRevenue: null }, managed: { annualRevenue: null } });
  });
  it("retains legitimate zeros and never divides by zero", () => {
    const data = createProposalFixture(); data.ltr.annualRent = 0; data.property.estimatedValue = 0;
    expect(comparisonRows(data, "annual")[0].value).toBe(0);
    expect(comparisonRows(data, "yield")[0].value).toBeNull();
  });
  it("strips private fields and rejects unsafe media URLs", () => {
    const data = proposalDataSchema.parse({ ...createProposalFixture(), recipient: { displayName: "Jordan", email: "private@example.test", phone: "123" }, privateNotes: "secret" });
    expect(JSON.stringify(data)).not.toMatch(/private|phone|email/);
    expect(proposalDataSchema.safeParse({ ...data, property: { ...data.property, heroImageUrl: "javascript:alert(1)" } }).success).toBe(false);
    const report = getStrPlaygroundReport(); report.property.hero_image_url = "javascript:alert(1)"; report.copy.disclaimer = "";
    expect(proposalFromReport(report).property.heroImageUrl).toBe("");
    expect(proposalFromReport(report).disclaimer).toBe(DEFAULT_DISCLAIMER);
  });
});

describe("data tokens", () => {
  it("keeps typed numbers and formats currency only for text", () => {
    const data = createProposalFixture();
    expect(readToken("str.market.annualRevenue", data)).toBe(98500);
    expect(resolveTokenText("Market: {{ str.market.annualRevenue }}", data).text).toBe("Market: $98,500");
  });
  it("omits missing optional lines without damaging the remaining copy", () => {
    expect(resolveTokenText("Prepared for {{recipient.displayName}}\nBy {{agency.name}}", createProposalFixture("general"))).toEqual({ text: "By Coast & Country", missing: ["recipient.displayName"], unknown: [] });
  });
  it("rejects private paths, prototype access and incomplete tokens", () => {
    const result = resolveTokenText("{{recipient.email}}\n{{__proto__}}\n{{constructor}}\n{{property.address", createProposalFixture());
    expect(result.text).toBe("");
    expect(result.unknown).toEqual(["recipient.email", "__proto__", "constructor", "Incomplete data token"]);
  });
  it("validates all content fields before saving and rejects unsupported versions", () => {
    const draft = structuredClone(DEFAULT_PROPOSAL_DRAFT); draft.content.introduction = "{{privateNotes}}";
    expect(validateProposalDraft(draft, createProposalFixture()).draft).toBeNull();
    expect(validateProposalDraft({ ...draft, version: 2 }, createProposalFixture()).draft).toBeNull();
    expect(validateProposalDraft(DEFAULT_PROPOSAL_DRAFT, createProposalFixture("general")).errors).toEqual([]);
  });
});

describe("brand inheritance", () => {
  it("applies layers in order and only permits unlocked appraisal overrides", () => {
    const result = resolveProposalBrand({ presetId: "coastal", account: { primary: "#111111" }, template: { primary: "#222222", radius: 7 }, appraisal: { primary: "#333333", radius: 25, text: "#aaaaaa" }, lockedFields: ["primary"], editableFields: ["primary", "radius"] });
    expect(result.values.primary).toBe("#222222"); expect(result.sources.primary).toBe("template");
    expect(result.values.radius).toBe(25); expect(result.sources.radius).toBe("appraisal");
    expect(result.values.text).toBe(BRAND_PRESETS.coastal.values.text);
  });
  it("resets to inheritance and switches presets without leaking old defaults", () => {
    const overrides = { primary: "#aabbcc" };
    const coastal = resolveProposalBrand({ presetId: "coastal", template: overrides });
    const studio = resolveProposalBrand({ presetId: "studio", template: overrides });
    expect(coastal.values.primary).toBe(studio.values.primary);
    expect(studio.values.radius).toBe(2);
    expect(resolveProposalBrand({ presetId: "staypack", template: resetBrandOverride(overrides, "primary") }).values.primary).toBe(BRAND_DEFAULTS.primary);
    expect(overrides.primary).toBe("#aabbcc");
  });
  it("rejects invalid CSS values, unknown settings and unsafe font values", () => {
    for (const value of [{ primary: "red" }, { radius: -1 }, { radius: 500 }, { css: "body{}" }, { headingFont: "url(https://example.test)" }]) expect(brandOverridesSchema.safeParse(value).success).toBe(false);
  });
  it("adapts existing account settings using valid values only", () => {
    const agency = getStrPlaygroundReport().agency; agency.primary_colour = "invalid";
    expect(brandFromReport(agency).primary).toBeUndefined();
    expect(brandFromReport(agency).headingFont).toBe("Fraunces, Georgia, serif");
  });
  it("keeps preset text contrast above AA for normal text", () => {
    for (const presetId of Object.keys(BRAND_PRESETS) as (keyof typeof BRAND_PRESETS)[]) {
      const { values: b } = resolveProposalBrand({ presetId });
      expect(contrastRatio(b.text, b.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(b.muted, b.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(b.primaryText, b.primary)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
