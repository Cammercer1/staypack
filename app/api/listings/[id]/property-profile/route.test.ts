import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { hasFreshPropertyProfile, refreshPropertyProfile } from "@/lib/domain-avm/refreshPropertyProfile";
import { calculatorLeadPropertyEvidence, lookupCalculatorLeadProperty } from "@/lib/str-calculator/leadProperty";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import type { Listing } from "@/lib/types";
import { POST } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireListingAccess: vi.fn() }));
vi.mock("@/lib/domain-avm/refreshPropertyProfile", () => ({ hasFreshPropertyProfile: vi.fn(), refreshPropertyProfile: vi.fn() }));
vi.mock("@/lib/str-calculator/leadProperty", () => ({ lookupCalculatorLeadProperty: vi.fn(), calculatorLeadPropertyEvidence: vi.fn() }));
afterEach(() => vi.resetAllMocks());
function setup(conflict = false, overrides: Partial<Listing> = {}, linked?: { report: Record<string, unknown> | null; lead: Record<string, unknown> | null }) {
  const listing = { ...createLintRegressionFixtures().listing, ...overrides };
  let saved: Record<string, unknown> = {};
  const query = { update: vi.fn((data: Record<string, unknown>) => { saved = data; return query; }), eq: vi.fn(() => query), select: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: conflict ? null : { ...listing, ...saved }, error: null })) };
  const readQuery = (data: unknown) => { const q = { select: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: vi.fn(async () => ({ data, error: null })) }; return q; };
  const reportQuery = readQuery(linked?.report ?? null), leadQuery = readQuery(linked?.lead ?? null);
  const from = vi.fn((table: string) => table === "reports" ? reportQuery : table === "str_calculator_leads" ? leadQuery : query);
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>);
  vi.mocked(requireListingAccess).mockResolvedValue({ listing, agency: { country_code: listing.country === "United States" ? "US" : "AU" }, supabase: { from } } as unknown as Awaited<ReturnType<typeof requireListingAccess>>);
  vi.mocked(refreshPropertyProfile).mockResolvedValue({ ...listing.scraped_listing_json!, domainAvm: undefined, propertyLookup: { source: "domain", matchedAt: new Date().toISOString(), media: [], originalAgents: [] } });
  const post = (body: Record<string, unknown>) => POST(new Request("http://localhost/api/property-profile", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: listing.id }) });
  return { listing, query, from, reportQuery, leadQuery, post, request: (refresh = false) => post({ refresh }) };
}
it("checks access before provider calls or database writes", async () => {
  const { query, request } = setup();
  vi.mocked(requireListingAccess).mockRejectedValue(new Error("Not authorised"));
  expect((await request()).status).toBe(400);
  expect(refreshPropertyProfile).not.toHaveBeenCalled();
  expect(query.update).not.toHaveBeenCalled();
});
it("uses cached evidence unless the user requests a refresh", async () => {
  const { request } = setup();
  vi.mocked(hasFreshPropertyProfile).mockReturnValue(true);
  expect((await (await request()).json()).cached).toBe(true);
  expect(refreshPropertyProfile).not.toHaveBeenCalled();
  expect((await request(true)).status).toBe(200);
  expect(refreshPropertyProfile).toHaveBeenCalledTimes(1);
});
it("scopes updates to the agency and exact listing version, reporting concurrent edits", async () => {
  const { request, query, listing } = setup(true);
  expect((await request()).status).toBe(409);
  expect(query.eq).toHaveBeenCalledWith("id", listing.id);
  expect(query.eq).toHaveBeenCalledWith("agency_id", listing.agency_id);
  expect(query.eq).toHaveBeenCalledWith("updated_at", listing.updated_at);
  expect(Object.keys(query.update.mock.calls[0][0])).toEqual(["scraped_listing_json"]);
});
it("does not write when the provider cannot verify a matching property", async () => {
  const { request, query } = setup();
  vi.mocked(refreshPropertyProfile).mockRejectedValue(new Error("Profile did not match"));
  expect((await request()).status).toBe(400);
  expect(query.update).not.toHaveBeenCalled();
});
it("explains quota exhaustion without exposing the provider response", async () => {
  const { request, query } = setup();
  vi.mocked(refreshPropertyProfile).mockRejectedValue(new Error('Domain AVM request failed (429): {"message":"MONTHLY quota"}'));
  const response = await request();
  expect(response.status).toBe(429);
  expect((await response.json()).error).toBe("Property lookup is temporarily unavailable. Use the saved details or enter the figures and amenities manually.");
  expect(query.update).not.toHaveBeenCalled();
});

const reviewedAddress = { property_address: "2/24 Cliffbrook Parade", suburb: "Clovelly", state: "NSW", postcode: "2031" };
const selectedCandidate = { source: "domain" as const, country: "AU" as const, address: "2/24 Cliffbrook Parade, Clovelly NSW 2031",
  streetAddress: reviewedAddress.property_address, suburb: reviewedAddress.suburb, state: "NSW", postcode: "2031", slug: "2-24-cliffbrook-parade-clovelly-nsw-2031" };
const importedEvidence = {
  scraped_listing_json: { images: ["https://example.test/new.jpg"], agents: [], confidence: "high" as const, warnings: [],
    domainAvm: { urlSlug: "new-property", address: reviewedAddress.property_address, comparableSales: [], matchedAt: new Date().toISOString(), rentalEstimate: { weeklyRent: 850, confidence: "medium" as const } } },
  hero_image_url: "https://example.test/new.jpg", selected_image_urls: ["https://example.test/new.jpg"], listing_image_meta: {}, property_type: "Apartment", car_spaces: 1,
};

it("imports photos and rent during calculator review while keeping the enquiry's beds, baths, guests and coordinates", async () => {
  const { post, query, listing } = setup(false, { ...createEmptyListingDraft(), id: "lead-property", agency_id: "agency", ...reviewedAddress,
    bedrooms: 2, bathrooms: 1.5, accommodates: 4, latitude: -33.912, longitude: 151.263 });
  vi.mocked(lookupCalculatorLeadProperty).mockResolvedValue(importedEvidence);
  const response = await post({ calculatorReview: true });
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(lookupCalculatorLeadProperty).toHaveBeenCalledWith(listing, "AU", undefined);
  expect(body.listing).toMatchObject({ bedrooms: 2, bathrooms: 1.5, accommodates: 4, latitude: listing.latitude, longitude: listing.longitude,
    hero_image_url: importedEvidence.hero_image_url, scraped_listing_json: importedEvidence.scraped_listing_json });
  expect(query.update).toHaveBeenCalledWith(importedEvidence);
  expect(refreshPropertyProfile).not.toHaveBeenCalled();
});

it("saves an explicitly selected corrected property and clears old evidence without changing manual room counts", async () => {
  const { post, query, listing } = setup();
  vi.mocked(lookupCalculatorLeadProperty).mockResolvedValue(importedEvidence);
  const response = await post({ calculatorReview: true, candidate: selectedCandidate });
  const body = await response.json();
  expect(body.identity_changed).toBe(true);
  expect(body.listing).toMatchObject({ ...reviewedAddress, latitude: null, longitude: null, bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, accommodates: listing.accommodates,
    uploaded_image_urls: [], collateral_image_selections: {}, advertised_sale_price: null, advertised_weekly_rent: null, appraisal_overrides_json: {}, ...importedEvidence });
  expect(lookupCalculatorLeadProperty).toHaveBeenCalledWith(expect.objectContaining({ ...reviewedAddress, latitude: null, longitude: null, scraped_listing_json: null }), "AU", selectedCandidate);
  expect(query.eq).toHaveBeenCalledWith("agency_id", listing.agency_id);
  expect(query.eq).toHaveBeenCalledWith("updated_at", listing.updated_at);
  expect(query.update.mock.calls[0][0]).not.toHaveProperty("final_report_json");
});

it("persists a corrected manual address and removes stale photos and valuations even when lookup has no match", async () => {
  const { post, listing } = setup();
  vi.mocked(lookupCalculatorLeadProperty).mockRejectedValue(new Error("No matching property profile was found."));
  const response = await post({ calculatorReview: true, address: reviewedAddress });
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body).toMatchObject({ identity_changed: true, profile_warning: "No matching property profile was found.", listing: {
    ...reviewedAddress, scraped_listing_json: null, latitude: null, longitude: null, hero_image_url: null, selected_image_urls: [], bedrooms: listing.bedrooms,
  } });
});

it("keeps a selected photo on a same-property retry and reuses fresh imported profile evidence", async () => {
  const { post, listing } = setup(false, reviewedAddress);
  vi.mocked(hasFreshPropertyProfile).mockReturnValue(true);
  vi.mocked(calculatorLeadPropertyEvidence).mockReturnValue(importedEvidence);
  const body = await (await post({ calculatorReview: true })).json();
  expect(body.cached).toBe(true);
  expect(body.listing.hero_image_url).toBe(listing.hero_image_url);
  expect(body.listing.selected_image_urls).toEqual(listing.selected_image_urls);
  expect(lookupCalculatorLeadProperty).not.toHaveBeenCalled();
});

it("routes a verified US selection through the Zillow importer", async () => {
  const address = { property_address: "123 Main St Apt 2", suburb: "Austin", state: "TX", postcode: "78701" };
  const candidate = { source: "zillow", country: "US", address: "123 Main St Apt 2, Austin, TX 78701", streetAddress: address.property_address,
    suburb: "Austin", state: "TX", postcode: "78701", zpid: "12345" };
  const { post } = setup(false, { ...address, country: "United States" });
  vi.mocked(lookupCalculatorLeadProperty).mockResolvedValue(importedEvidence);
  expect((await post({ calculatorReview: true, candidate })).status).toBe(200);
  expect(lookupCalculatorLeadProperty).toHaveBeenCalledWith(expect.objectContaining(address), "US", candidate);
});

it.each([
  { calculatorReview: true, candidate: { ...selectedCandidate, country: "US" } },
  { calculatorReview: true, candidate: { ...selectedCandidate, source: "zillow" } },
  { calculatorReview: true, candidate: { ...selectedCandidate, partialMatch: true } },
  { calculatorReview: true, address: { ...reviewedAddress, postcode: "78701" } },
  { address: reviewedAddress },
])("rejects unsafe address corrections before provider calls or writes: %j", async input => {
  const { post, query } = setup();
  expect((await post(input)).status).toBe(400);
  expect(query.update).not.toHaveBeenCalled();
  expect(lookupCalculatorLeadProperty).not.toHaveBeenCalled();
});

it("never overwrites concurrent edits after a calculator property lookup", async () => {
  const { post } = setup(true);
  vi.mocked(lookupCalculatorLeadProperty).mockResolvedValue(importedEvidence);
  expect((await post({ calculatorReview: true, candidate: selectedCandidate })).status).toBe(409);
});

it("retains saved data and offers a recoverable error when an unchanged property lookup fails", async () => {
  const { post, query } = setup();
  vi.mocked(lookupCalculatorLeadProperty).mockRejectedValue(new Error("No matching property profile was found."));
  expect((await post({ calculatorReview: true })).status).toBe(400);
  expect(query.update).not.toHaveBeenCalled();
});

it("requires listing access and an active property before calculator lookups", async () => {
  const { post, query } = setup(false, { status: "archived" });
  expect((await post({ calculatorReview: true, candidate: selectedCandidate })).status).toBe(409);
  vi.mocked(requireListingAccess).mockRejectedValue(new Error("Not authorised"));
  expect((await post({ calculatorReview: true, candidate: selectedCandidate })).status).toBe(400);
  expect(lookupCalculatorLeadProperty).not.toHaveBeenCalled();
  expect(query.update).not.toHaveBeenCalled();
});

it("clears stale evidence when unit-first comma addresses refer to a different house", async () => {
  const { post } = setup(false, { ...reviewedAddress, property_address: "Unit 2, 24 Cliffbrook Parade", latitude: -33.91, longitude: 151.26 });
  vi.mocked(lookupCalculatorLeadProperty).mockRejectedValue(new Error("No matching property profile was found."));
  const corrected = { ...reviewedAddress, property_address: "Unit 2, 26 Cliffbrook Parade" };
  const response = await post({ calculatorReview: true, address: corrected });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ identity_changed: true, listing: {
    ...corrected, latitude: null, longitude: null, scraped_listing_json: null, hero_image_url: null, selected_image_urls: [],
  } });
});

const reportId = "b7067c85-6745-48c7-a9f8-e48cdb91d854";
const canonicalLead = { address: "2/24 Cliffbrook Parade, Coogee NSW 2034", country: "AU", status: "estimated",
  estimate_json: { address: "Unit 2/24 Cliffbrook Parade, Clovelly NSW 2031, Australia" } };
const wrongLocality = { ...createEmptyListingDraft(), ...reviewedAddress, suburb: "Coogee", postcode: "2034",
  latitude: -33.9147613, longitude: 151.264161, bedrooms: 2, bathrooms: 1, accommodates: 4 };

it("automatically looks up the exact canonical unit while retaining its original estimate coordinates and user photos", async () => {
  const f = setup(false, { ...wrongLocality, hero_image_url: "https://example.test/chosen.jpg", selected_image_urls: ["https://example.test/chosen.jpg"], uploaded_image_urls: ["https://example.test/upload.jpg"] },
    { report: { status: "estimated", published_at: null, final_report_json: null }, lead: canonicalLead });
  vi.mocked(lookupCalculatorLeadProperty).mockResolvedValue(importedEvidence);
  const response = await f.post({ calculatorReview: true, reportId });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ address_corrected: true, identity_changed: false, listing: {
    property_address: "Unit 2/24 Cliffbrook Parade", suburb: "Clovelly", postcode: "2031",
    latitude: wrongLocality.latitude, longitude: wrongLocality.longitude, bedrooms: 2, bathrooms: 1, accommodates: 4,
    hero_image_url: f.listing.hero_image_url, selected_image_urls: f.listing.selected_image_urls, uploaded_image_urls: f.listing.uploaded_image_urls,
    scraped_listing_json: importedEvidence.scraped_listing_json,
  } });
  expect(lookupCalculatorLeadProperty).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ property_address: "Unit 2/24 Cliffbrook Parade", suburb: "Clovelly", postcode: "2031", latitude: wrongLocality.latitude }), "AU", undefined);
  expect(f.reportQuery.eq).toHaveBeenCalledWith("id", reportId);
  expect(f.reportQuery.eq).toHaveBeenCalledWith("listing_id", f.listing.id);
  expect(f.reportQuery.eq).toHaveBeenCalledWith("agency_id", f.listing.agency_id);
  expect(f.leadQuery.eq).toHaveBeenCalledWith("report_id", reportId);
  expect(f.leadQuery.eq).toHaveBeenCalledWith("agency_id", f.listing.agency_id);
});

it.each([null, { ...canonicalLead, estimate_json: { address: "Unit 1/24 Cliffbrook Parade, Clovelly NSW 2031, Australia" } }])("never invents a canonical address for missing or mismatched lead evidence", async lead => {
  const f = setup(false, wrongLocality, { report: { status: "estimated" }, lead });
  vi.mocked(lookupCalculatorLeadProperty).mockResolvedValue(importedEvidence);
  expect((await f.post({ calculatorReview: true, reportId })).status).toBe(200);
  expect(lookupCalculatorLeadProperty).toHaveBeenCalledWith(f.listing, "AU", undefined);
  expect(f.query.update.mock.calls[0][0]).not.toHaveProperty("suburb");
});

it("rejects a report outside this listing before reading private lead evidence or doing lookup", async () => {
  const f = setup(false, wrongLocality, { report: null, lead: canonicalLead });
  expect((await f.post({ calculatorReview: true, reportId })).status).toBe(400);
  expect(createAdminClient).not.toHaveBeenCalled();
  expect(lookupCalculatorLeadProperty).not.toHaveBeenCalled();
  expect(f.query.update).not.toHaveBeenCalled();
});

it("lets explicit property selection win over automatic correction", async () => {
  const f = setup(false, wrongLocality, { report: { status: "estimated" }, lead: canonicalLead });
  vi.mocked(lookupCalculatorLeadProperty).mockResolvedValue(importedEvidence);
  expect((await f.post({ calculatorReview: true, reportId, candidate: selectedCandidate })).status).toBe(200);
  expect(createAdminClient).not.toHaveBeenCalled();
  expect(lookupCalculatorLeadProperty).toHaveBeenCalledWith(expect.objectContaining({ ...reviewedAddress, latitude: null }), "AU", selectedCandidate);
});
