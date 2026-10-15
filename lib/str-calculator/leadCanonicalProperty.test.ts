import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { Report } from "@/lib/types";
import { calculatorPropertyReviewKey } from "./propertyReviewIdentity";
import { automaticCalculatorAddress, canonicalCalculatorSourceKey, loadCanonicalCalculatorLead, type CanonicalCalculatorLead } from "./leadCanonicalProperty";

vi.mock("server-only", () => ({}));
afterEach(() => vi.clearAllMocks());

const canonical = { property_address: "Unit 2/24 Cliffbrook Parade", suburb: "Clovelly", state: "NSW", postcode: "2031" };
function fixture() {
  const f = createLintRegressionFixtures();
  const raw = { provider: "airroi", input: { latitude: -33.9147613, longitude: 151.264161, bedrooms: 2, bathrooms: 1, accommodates: 4, currency: "AUD", radiusM: 2000 },
    response: { revenue: 65322, comparables: [{ id: "same-property-evidence", revenue: 62500 }] }, fetched_at: "2026-10-15T12:10:31.302217+00:00" };
  const lead: CanonicalCalculatorLead = { address: "2/24 Cliffbrook Parade, Coogee NSW 2034", country: "AU", status: "estimated",
    estimate_json: { address: "Unit 2/24 Cliffbrook Parade, Clovelly NSW 2031, Australia" }, original_estimate_json: structuredClone(raw), completed_at: "2026-10-16T00:00:00.000Z" };
  const listing = { ...f.listing, property_address: "2/24 Cliffbrook Parade", suburb: "Coogee", state: "NSW", postcode: "2034", country: "Australia" };
  const report: Report = { ...f.report, status: "estimated", published_at: null, final_report_json: null,
    user_overrides_json: { calculatorReview: { status: "pending", propertyKey: calculatorPropertyReviewKey(listing) } },
    original_estimate_json: { ...f.report.original_estimate_json!, raw: structuredClone(raw) } };
  return { lead, listing, report, raw };
}

it("corrects an untouched enquiry to its server-saved locality while retaining its exact unit", () => {
  const f = fixture(); const before = structuredClone(f);
  expect(automaticCalculatorAddress(f.lead, f.listing, f.report)).toEqual(canonical);
  expect(f).toEqual(before);
});

it.each([
  ["published status", { status: "published" }], ["archived status", { status: "archived" }], ["publication time", { published_at: "2026-10-16T00:00:00Z" }],
  ["saved snapshot", { final_report_json: createLintRegressionFixtures().report.final_report_json }],
  ["verified property", { user_overrides_json: { calculatorReview: { status: "verified", propertyKey: "already-reviewed" } } }],
] as const)("does not automatically change previously published or verified reports (%s)", (_name, patch) => {
  const f = fixture();
  expect(automaticCalculatorAddress(f.lead, f.listing, { ...f.report, ...patch } as Report)).toBeNull();
});

it("does not reset a draft after the user has already saved reviewed property details", () => {
  const f = fixture();
  f.report.user_overrides_json = { ...f.report.user_overrides_json,
    strProperty: { weeklyRent: 1285, amenities: ["wifi"], additionalAmenities: [] } };
  const before = structuredClone(f.report);
  expect(automaticCalculatorAddress(f.lead, f.listing, f.report)).toBeNull();
  expect(f.report).toEqual(before);
});

it.each([
  { property_address: "1/24 Cliffbrook Parade" }, { property_address: "24 Cliffbrook Parade" },
  { property_address: "2/26 Cliffbrook Parade" }, { suburb: "Clovelly", postcode: "2031" },
  { country: "United States" },
])("keeps a listing that no longer matches the original enquiry (%j)", patch => {
  const f = fixture();
  expect(automaticCalculatorAddress(f.lead, { ...f.listing, ...patch }, f.report)).toBeNull();
});

it.each([
  { status: "failed" }, { status: "processing" }, { estimate_json: null }, { estimate_json: { address: 123 } },
  { estimate_json: { address: "1/24 Cliffbrook Parade, Clovelly NSW 2031, Australia" } },
  { estimate_json: { address: "24 Cliffbrook Parade, Clovelly NSW 2031, Australia" } },
  { estimate_json: { address: "2/24 Cliffbrook Parade, Clovelly VIC 3031, Australia" } },
  { estimate_json: { address: "Unit 2, 24 Cliffbrook Parade, Clovelly NSW 2031, Australia" } },
])("rejects missing, failed or different-property canonical evidence (%j)", patch => {
  const f = fixture(); const lead = { ...f.lead, ...patch };
  expect(automaticCalculatorAddress(lead, f.listing, f.report)).toBeNull();
  expect(canonicalCalculatorSourceKey(lead, f.report)).toBeNull();
});

it("certifies only the original lead estimate even when JSON object key order changes", () => {
  const f = fixture();
  f.report.original_estimate_json!.raw = { fetched_at: f.raw.fetched_at,
    response: { comparables: [{ revenue: 62500, id: "same-property-evidence" }], revenue: 65322 },
    input: Object.fromEntries(Object.entries(f.raw.input).reverse()), provider: "airroi" };
  expect(canonicalCalculatorSourceKey(f.lead, f.report)).toBe(calculatorPropertyReviewKey({ ...canonical, country: "AU" }));
});

it.each([
  { provider: "other-provider" }, { input: { latitude: -33.9147613, longitude: 151.264161 } },
  { response: { revenue: 65323, comparables: [{ id: "same-property-evidence", revenue: 62500 }] } },
  { response: { revenue: 65322, comparables: [{ id: "another-property-evidence", revenue: 62500 }] } },
  { response: null }, { response: [] }, { fetched_at: "2026-10-16T00:00:00Z" }, { fetched_at: undefined },
])("does not certify replaced or incomplete report evidence despite matching coordinates (%j)", patch => {
  const f = fixture(); f.report.original_estimate_json!.raw = { ...f.raw, ...patch };
  expect(canonicalCalculatorSourceKey(f.lead, f.report)).toBeNull();
});

it("requires an original raw response on both the lead and report", () => {
  const f = fixture();
  expect(canonicalCalculatorSourceKey({ ...f.lead, original_estimate_json: null }, f.report)).toBeNull();
  expect(canonicalCalculatorSourceKey(f.lead, { ...f.report, original_estimate_json: null })).toBeNull();
});

it("recognises the legacy completion-time provenance without extending it", () => {
  const f = fixture(); const legacyRaw: Partial<typeof f.raw> = { ...f.raw };
  delete legacyRaw.fetched_at;
  f.lead.original_estimate_json = legacyRaw;
  f.report.original_estimate_json!.raw = { ...legacyRaw, fetched_at: f.lead.completed_at };
  expect(canonicalCalculatorSourceKey(f.lead, f.report)).toBe(calculatorPropertyReviewKey({ ...canonical, country: "AU" }));
  f.report.original_estimate_json!.raw = { ...legacyRaw, fetched_at: "2026-10-17T00:00:00Z" };
  expect(canonicalCalculatorSourceKey(f.lead, f.report)).toBeNull();
});

function database(result: { data: CanonicalCalculatorLead | null; error: unknown }) {
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn(async () => result) };
  const from = vi.fn(() => query);
  return { query, from, client: { from } as unknown as SupabaseClient };
}

it("loads only the current agency's report-linked lead without a write", async () => {
  const { lead } = fixture(); const db = database({ data: lead, error: null });
  expect(await loadCanonicalCalculatorLead("agency-id", "report-id", db.client)).toEqual(lead);
  expect(db.from).toHaveBeenCalledExactlyOnceWith("str_calculator_leads");
  expect(db.query.eq.mock.calls).toEqual([["report_id", "report-id"], ["agency_id", "agency-id"]]);
  expect(db.query.maybeSingle).toHaveBeenCalledTimes(1);
});

it("does not invent canonical evidence for an unlinked report", async () => {
  const db = database({ data: null, error: null });
  expect(await loadCanonicalCalculatorLead("agency-id", "report-id", db.client)).toBeNull();
});

it("fails closed with a recoverable message when the linked lead cannot be read", async () => {
  const db = database({ data: null, error: { message: "private database error" } });
  await expect(loadCanonicalCalculatorLead("agency-id", "report-id", db.client)).rejects.toThrow("Couldn’t check this enquiry’s saved address. Please try again.");
});
