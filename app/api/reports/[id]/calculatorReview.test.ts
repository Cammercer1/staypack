import { afterEach, expect, it, vi } from "vitest";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { generateReportCopy } from "@/lib/openai/generateReportCopy";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { POST as publish } from "./publish/route";
import { POST as generate } from "./generate-copy/route";
import { PATCH as save } from "./route";
import { calculatorPropertyReviewKey } from "@/lib/str-calculator/propertyReviewIdentity";
import { calculateAccommodates } from "@/lib/reports/formatters";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/requireUser", () => ({ requireReportWithListing: vi.fn() }));
vi.mock("@/lib/openai/generateReportCopy", () => ({
  generateReportCopy: vi.fn(), CopyOpenAIError: class extends Error {}, CopyValidationError: class extends Error {},
}));
vi.mock("@/lib/env", () => ({ getReportsUrl: () => "https://staypack.example" }));
afterEach(() => vi.clearAllMocks());

function setup(status?: "pending" | "verified") {
  const fixture = createLintRegressionFixtures();
  fixture.report.user_overrides_json = { ...fixture.report.user_overrides_json,
    estimateInputs: { bedrooms: fixture.listing.bedrooms!, bathrooms: fixture.listing.bathrooms!, accommodates: calculateAccommodates(fixture.listing.bedrooms, fixture.listing.accommodates) },
    ...(status ? { calculatorReview: { status, propertyKey: calculatorPropertyReviewKey(fixture.listing) } } : {}) };
  const query = {
    update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: fixture.report, error: null }),
  };
  const from = vi.fn().mockReturnValue(query);
  vi.mocked(requireReportWithListing).mockResolvedValue({ ...fixture, supabase: { from } } as unknown as Awaited<ReturnType<typeof requireReportWithListing>>);
  return { ...fixture, query, from };
}
const request = () => new Request("https://staypack.example/report", { method: "POST", body: "{}" });
const params = { params: Promise.resolve({ id: "report" }) };

it.each([["publish", publish], ["generate", generate]] as const)("requires calculator property confirmation before %s, with no provider calls or report writes", async (_name, action) => {
  const { report, from } = setup("pending");
  const before = structuredClone(report);
  const response = await action(request(), params);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "Confirm the property details before publishing this proposal." });
  expect(from).not.toHaveBeenCalled();
  expect(generateReportCopy).not.toHaveBeenCalled();
  expect(report).toEqual(before);
});

it.each([undefined, "verified"] as const)("allows the existing publish flow for reports with calculator review %s", async status => {
  const { report, query } = setup(status);
  const response = await publish(request(), params);
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
  expect((await response.json()).report.final_report_json).toEqual(report.final_report_json);
});

it.each([{}, { calculatorReview: { status: "verified", propertyKey: "forged-property" } }])("keeps the server-owned pending review when generic report overrides are replaced", async overrides => {
  const { report, query } = setup("pending");
  const response = await save(new Request("https://staypack.example/report", {
    method: "PATCH", body: JSON.stringify({ user_overrides_json: overrides }),
  }), params);
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ user_overrides_json: { calculatorReview: report.user_overrides_json!.calculatorReview, estimateInputs: report.user_overrides_json!.estimateInputs } }));
});

it("does not accept a client-created review marker on an existing report", async () => {
  const { query } = setup();
  const response = await save(new Request("https://staypack.example/report", {
    method: "PATCH", body: JSON.stringify({ user_overrides_json: { calculatorReview: { status: "pending", propertyKey: "forged-property" }, recommendedAnnualRevenue: 75000 } }),
  }), params);
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ user_overrides_json: { recommendedAnnualRevenue: 75000 } }));
});

it("cannot publish a pending calculator report using the generic status patch", async () => {
  const { from } = setup("pending");
  const response = await save(new Request("https://staypack.example/report", {
    method: "PATCH", body: JSON.stringify({ status: "published" }),
  }), params);
  expect(response.status).toBe(409);
  expect(from).not.toHaveBeenCalled();
});

it.each(["property_address", "suburb", "postcode", "bedrooms", "bathrooms", "accommodates"] as const)("requires fresh review if %s changes after confirmation", async field => {
  const { listing, from } = setup("verified");
  if (field === "bedrooms" || field === "bathrooms" || field === "accommodates") listing[field] = (listing[field] ?? 0) + 1;
  else listing[field] = `Different ${listing[field]}`;
  expect((await publish(request(), params)).status).toBe(409);
  expect((await generate(request(), params)).status).toBe(409);
  expect(from).not.toHaveBeenCalled();
});

it("cannot forge confirmed configuration through generic overrides", async () => {
  const { report, query } = setup("verified");
  const response = await save(new Request("https://staypack.example/report", { method: "PATCH", body: JSON.stringify({
    user_overrides_json: { estimateInputs: { bedrooms: 12, bathrooms: 8, accommodates: 25 } },
  }) }), params);
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ user_overrides_json: {
    calculatorReview: report.user_overrides_json!.calculatorReview, estimateInputs: report.user_overrides_json!.estimateInputs,
  } }));
});

const propertyContext = { propertyValue: 1500000, weeklyRent: 900, amenities: [], additionalAmenities: [] };
it("saves reviewed calculator property inputs without replacing an existing published report or PDF", async () => {
  const { report, query } = setup("verified");
  report.status = "published";
  const before = structuredClone(report);
  const response = await save(new Request("https://staypack.example/report", { method: "PATCH", body: JSON.stringify({
    calculator_property_review: true, str_property: propertyContext,
  }) }), params);
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledExactlyOnceWith({ user_overrides_json: { ...before.user_overrides_json, strProperty: propertyContext,
    calculatorReview: { ...before.user_overrides_json!.calculatorReview, detailsPropertyKey: before.user_overrides_json!.calculatorReview!.propertyKey } } });
  expect(report.final_report_json).toEqual(before.final_report_json);
  expect(report.pdf_url).toBe(before.pdf_url);
  expect(report.published_at).toBe(before.published_at);
});

it("verifies the scoped calculator lead for an older published report before preserving its snapshot", async () => {
  const { report, agency, from, query } = setup();
  report.status = "published";
  const lead = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "lead" }, error: null }) };
  from.mockImplementation(table => table === "str_calculator_leads" ? lead : query);
  const before = structuredClone(report);
  const response = await save(new Request("https://staypack.example/report", { method: "PATCH", body: JSON.stringify({ calculator_property_review: true, str_property: propertyContext }) }), params);
  expect(response.status).toBe(200);
  expect(lead.eq).toHaveBeenCalledWith("report_id", report.id);
  expect(lead.eq).toHaveBeenCalledWith("agency_id", agency.id);
  expect(query.update).toHaveBeenCalledExactlyOnceWith({ user_overrides_json: { ...before.user_overrides_json, strProperty: propertyContext } });
  expect(report).toEqual(before);
});

it("does not accept a calculator review save for an unrelated report", async () => {
  const { from, query } = setup();
  const lead = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
  from.mockReturnValue(lead);
  const response = await save(new Request("https://staypack.example/report", { method: "PATCH", body: JSON.stringify({ calculator_property_review: true, str_property: propertyContext }) }), params);
  expect(response.status).toBe(400);
  expect(query.update).not.toHaveBeenCalled();
});

it.each([{ template_id: "standard-2-page" }, { ai_copy_json: {} }, { status: "published" }])("requires calculator review saves to remain separate from content changes", async extra => {
  const { from } = setup("verified");
  const response = await save(new Request("https://staypack.example/report", { method: "PATCH", body: JSON.stringify({ calculator_property_review: true, str_property: propertyContext, ...extra }) }), params);
  expect(response.status).toBe(400);
  expect(from).not.toHaveBeenCalled();
});

it("records the corrected property's detail identity without certifying its old estimate or changing its published snapshot", async () => {
  const { report, listing, query } = setup("pending");
  report.status = "published";
  const before = structuredClone(report);
  listing.property_address = "2/24 Cliffbrook Parade";
  listing.suburb = "Clovelly";
  listing.state = "NSW";
  listing.postcode = "2031";
  const response = await save(new Request("https://staypack.example/report", { method: "PATCH", body: JSON.stringify({ calculator_property_review: true, str_property: propertyContext }) }), params);
  expect(response.status).toBe(200);
  const savedReview = { ...before.user_overrides_json!.calculatorReview, detailsPropertyKey: calculatorPropertyReviewKey(listing) };
  expect(savedReview.detailsPropertyKey).not.toBe(savedReview.propertyKey);
  expect(savedReview.status).toBe("pending");
  expect(query.update).toHaveBeenCalledExactlyOnceWith({ user_overrides_json: { ...before.user_overrides_json, strProperty: propertyContext, calculatorReview: savedReview } });
  expect(report.final_report_json).toEqual(before.final_report_json);
  expect(report.pdf_url).toBe(before.pdf_url);
});
