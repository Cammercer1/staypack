import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { geocodeReportAddress } from "@/lib/geocoding";
import { fetchStrEstimate } from "@/lib/str/estimate";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { estimateForCalculatorReview } from "@/lib/str-calculator/propertyReview";
import { calculatorPropertyReviewKey } from "@/lib/str-calculator/propertyReviewIdentity";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import type { Listing, Report } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishedReportSnapshot } from "@/lib/reports/publicationSnapshot";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: vi.fn() }));
vi.mock("@/lib/geocoding", () => ({ geocodeReportAddress: vi.fn() }));
vi.mock("@/lib/str/estimate", () => ({ fetchStrEstimate: vi.fn() }));
vi.mock("@/lib/str-calculator/propertyReview", async () => ({
  calculatorPropertyReviewKey: (await import("@/lib/str-calculator/propertyReviewIdentity")).calculatorPropertyReviewKey,
  estimateForCalculatorReview: vi.fn(),
}));
vi.mock("@/lib/reports/loadReportAgent", () => ({ loadAgencyAgentProfiles: vi.fn(), loadListingAgentProfile: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function setup(coordinates?: { latitude: number; longitude: number }) {
  const f = createLintRegressionFixtures();
  const listing = { ...f.listing, latitude: null, longitude: null, ...coordinates };
  const from = vi.fn();
  vi.mocked(requireReportWithListing).mockResolvedValue({
    report: f.report, listing, agency: f.agency, supabase: { from },
  } as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  vi.mocked(geocodeReportAddress).mockResolvedValue({
    latitude: -28.0167, longitude: 153.4, formattedAddress: "Development property", placeId: "mock-place-id",
  });
  return { from, listing };
}
function request(coordinates?: { latitude: number; longitude: number }) {
  return new Request("https://example.test/api/str/estimate", {
    method: "POST", body: JSON.stringify({ report_id: "b7067c85-6745-48c7-a9f8-e48cdb91d854", ...coordinates }),
  });
}

it("rejects mock geocoding before accessing the shared estimate cache or modifying a report", async () => {
  const { from } = setup();
  const response = await POST(request());
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("real property location") });
  expect(fetchStrEstimate).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it.each(["listing", "request"] as const)("keeps explicit real %s coordinates usable without geocoding", async (source) => {
  const coordinates = { latitude: -33.8, longitude: 151.2 };
  const { listing } = setup(source === "listing" ? coordinates : undefined);
  // Stop at the estimator: reaching it proves real coordinates remain usable.
  vi.mocked(fetchStrEstimate).mockRejectedValueOnce(new Error("Reached estimator"));
  const response = await POST(request(source === "request" ? coordinates : undefined));
  expect(await response.json()).toEqual({ error: "Reached estimator" });
  expect(geocodeReportAddress).not.toHaveBeenCalled();
  expect(fetchStrEstimate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(coordinates), listing, expect.anything());
});

function confirmationFixture(options: { published?: boolean; missingCoordinates?: boolean; conflict?: "listing" | "report" } = {}) {
  const f = createLintRegressionFixtures();
  let listing: Listing = { ...f.listing, property_address: "2/24 Cliffbrook Parade", suburb: "Clovelly", state: "NSW", postcode: "2031",
    country: "Australia", bedrooms: 2, bathrooms: 1, accommodates: 4,
    latitude: options.missingCoordinates ? null : -33.9, longitude: options.missingCoordinates ? null : 151.2 };
  const identity = calculatorPropertyReviewKey(listing);
  let report: Report = { ...f.report, status: options.published ? "published" : "estimated", pdf_url: options.published ? "https://example.test/published.pdf" : null,
    final_report_json: options.published ? f.report.final_report_json : null, ai_copy_json: options.published ? f.report.ai_copy_json : null,
    user_overrides_json: { calculatorReview: { status: "pending", propertyKey: identity }, estimateInputs: { bedrooms: 2, bathrooms: 1, accommodates: 4 } } };
  const before = structuredClone({ listing, report });
  const queries = Object.fromEntries((["listings", "reports"] as const).map(table => {
    let patch: Record<string, unknown> = {};
    const query = {
      update: vi.fn((value: Record<string, unknown>) => { patch = value; return query; }),
      eq: vi.fn(() => query), select: vi.fn(() => query),
      maybeSingle: vi.fn(async () => {
        if (options.conflict === "listing") return { data: null, error: null };
        listing = { ...listing, ...patch };
        return { data: listing, error: null };
      }),
      single: vi.fn(async () => {
        if (table === "reports") {
          if (options.conflict === "report") return { data: null, error: { message: "Report changed while evidence loaded" } };
          report = { ...report, ...patch };
          return { data: report, error: null };
        }
        return { data: listing, error: null };
      }),
    };
    return [table, query];
  }));
  const from = vi.fn((table: string) => queries[table]);
  vi.mocked(requireReportWithListing).mockResolvedValue({ report, listing, agency: f.agency, supabase: { from } } as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  vi.mocked(estimateForCalculatorReview).mockResolvedValue({ estimate: report.original_estimate_json!, enrichment: report.str_enrichment_json!, reused: true });
  vi.mocked(loadAgencyAgentProfiles).mockResolvedValue([f.agent]);
  vi.mocked(loadListingAgentProfile).mockResolvedValue(f.agent);
  vi.mocked(geocodeReportAddress).mockResolvedValue({ latitude: -33.9, longitude: 151.2, formattedAddress: "2/24 Cliffbrook Parade, Clovelly NSW 2031", placeId: "real-place-id" });
  return { before, identity, queries, from, agency: f.agency, getReport: () => report, getListing: () => listing };
}
const confirmationRequest = () => new Request("https://example.test/api/str/estimate", { method: "POST", body: JSON.stringify({
  report_id: "b7067c85-6745-48c7-a9f8-e48cdb91d854", confirm_calculator_property: true,
  address: "99 Wrong Street", latitude: 0, longitude: 0, bedrooms: 2, bathrooms: 1, accommodates: 4,
}) });

it("blocks a pending calculator report before fetching anything unless the property is explicitly confirmed", async () => {
  const f = confirmationFixture();
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(estimateForCalculatorReview).not.toHaveBeenCalled();
  expect(fetchStrEstimate).not.toHaveBeenCalled();
  expect(geocodeReportAddress).not.toHaveBeenCalled();
  expect(f.from).not.toHaveBeenCalled();
});

it.each([false, true])("confirms the persisted property identity and ignores submitted address/coordinates (needs geocoding: %s)", async missingCoordinates => {
  const f = confirmationFixture({ missingCoordinates });
  const response = await POST(confirmationRequest());
  expect(response.status).toBe(200);
  expect(estimateForCalculatorReview).toHaveBeenCalledExactlyOnceWith(
    { latitude: -33.9, longitude: 151.2, bedrooms: 2, bathrooms: 1, accommodates: 4 }, f.before.listing, f.before.report, f.identity,
  );
  if (missingCoordinates) expect(geocodeReportAddress).toHaveBeenCalledExactlyOnceWith({ property_address: "2/24 Cliffbrook Parade", suburb: "Clovelly", state: "NSW", postcode: "2031", country: "Australia" });
  else expect(geocodeReportAddress).not.toHaveBeenCalled();
  expect(fetchStrEstimate).not.toHaveBeenCalled();
  expect(f.getReport().user_overrides_json?.calculatorReview).toEqual({ status: "verified", propertyKey: f.identity, verifiedAt: expect.any(String) });
  expect(f.getReport().original_estimate_json).toEqual(f.before.report.original_estimate_json);
  expect(f.getReport().str_enrichment_json?.comps).toEqual(f.before.report.str_enrichment_json?.comps);
  for (const [table, original] of [["listings", f.before.listing], ["reports", f.before.report]] as const) {
    expect(f.queries[table].eq).toHaveBeenCalledWith("agency_id", f.agency.id);
    expect(f.queries[table].eq).toHaveBeenCalledWith("updated_at", original.updated_at);
  }
});

it("keeps an existing published report snapshot and PDF unchanged when confirming a calculator lead", async () => {
  const f = confirmationFixture({ published: true });
  expect((await POST(confirmationRequest())).status).toBe(200);
  expect(f.getReport().final_report_json).toEqual(f.before.report.final_report_json);
  expect(f.getReport().pdf_url).toBe(f.before.report.pdf_url);
  expect(f.getReport().published_at).toBe(f.before.report.published_at);
  expect(f.getReport().status).toBe("published");
  expect(f.getReport().user_overrides_json?.calculatorReview?.status).toBe("verified");
});

it("refreshes a published report's draft estimate without replacing its public revision", async () => {
  const f = confirmationFixture({ published: true });
  f.getReport().user_overrides_json!.calculatorReview!.status = "verified";
  vi.mocked(fetchStrEstimate).mockResolvedValue({
    estimate: { ...f.before.report.original_estimate_json!, annualRevenue: 150000 },
    enrichment: f.before.report.str_enrichment_json!,
  });
  expect((await POST(request())).status).toBe(200);
  expect(publishedReportSnapshot(f.getReport().final_report_json!)).toEqual(f.before.report.final_report_json);
  expect(f.getReport().final_estimate_json?.annualRevenue).toBe(150000);
  expect(f.getReport().pdf_url).toBeNull();
  expect(f.getReport().status).toBe("published");
});

it("does not verify a report when its listing changed during the evidence request", async () => {
  const f = confirmationFixture({ conflict: "listing" });
  expect((await POST(confirmationRequest())).status).toBe(409);
  expect(f.queries.reports.update).not.toHaveBeenCalled();
  expect(f.getReport()).toEqual(f.before.report);
});

it("does not overwrite a newer report or return successful verification after its version check fails", async () => {
  const f = confirmationFixture({ conflict: "report" });
  const response = await POST(confirmationRequest());
  expect(response.ok).toBe(false);
  expect(f.getReport()).toEqual(f.before.report);
  expect(f.getReport().user_overrides_json?.calculatorReview?.status).toBe("pending");
});

it.each([false, true])("uses the canonical source identity only for the exact linked lead evidence (changed raw: %s)", async changed => {
  const f = confirmationFixture();
  const report = f.getReport();
  const submittedKey = calculatorPropertyReviewKey({ ...f.before.listing, suburb: "Coogee", postcode: "2034" });
  report.user_overrides_json!.calculatorReview!.propertyKey = submittedKey;
  const raw = { provider: "airroi", input: { latitude: -33.9, longitude: 151.2, bedrooms: 2, bathrooms: 1, accommodates: 4 },
    response: { annualRevenue: 65322 }, fetched_at: new Date(Date.now() - 86400000).toISOString() };
  report.original_estimate_json!.raw = { ...raw, response: { annualRevenue: changed ? 70000 : 65322 } };
  const lead = { address: "2/24 Cliffbrook Parade, Coogee NSW 2034", country: "AU", status: "estimated",
    estimate_json: { address: "Unit 2/24 Cliffbrook Parade, Clovelly NSW 2031, Australia" }, original_estimate_json: raw };
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: lead, error: null })) };
  const from = vi.fn(() => query);
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>);
  expect((await POST(confirmationRequest())).status).toBe(200);
  expect(estimateForCalculatorReview).toHaveBeenCalledWith(expect.anything(), f.before.listing, expect.anything(), changed ? submittedKey : f.identity);
  expect(from).toHaveBeenCalledWith("str_calculator_leads");
  expect(query.eq).toHaveBeenCalledWith("agency_id", f.agency.id);
  expect(query.eq).toHaveBeenCalledWith("report_id", report.id);
  expect(geocodeReportAddress).not.toHaveBeenCalled();
});
