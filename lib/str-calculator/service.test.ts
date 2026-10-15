import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), geocode: vi.fn(), estimate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/geocoding/google", () => ({ geocodeAddress: mocks.geocode }));
vi.mock("@/lib/airroi/client", () => ({ fetchAirroiEstimate: mocks.estimate }));
import { loadPublicCalculator, submitCalculator } from "./service";

const token = "6500bfd0-04d8-4919-b458-84e9ec0ce331";
const input = { address: "12 Test Street, Sydney NSW 2000", bedrooms: 3, bathrooms: 1.5, email: "owner@example.com", consent: true, website: "", requestId: token };
const providerFetchedAt = "2026-10-01T00:00:00.000Z";
const providerRaw = {
  provider: "airroi", response: "private-provider-data", fetched_at: providerFetchedAt, request_id: "provider-request",
  input: { latitude: -33.8, longitude: 151.2, bedrooms: 3, bathrooms: 1.5, accommodates: 6, radiusM: 2000, currency: "AUD" },
};
function providerResult(costCents = 20) {
  return { estimate: { annualRevenue: 62400, monthlyRevenue: 5200, nightlyRate: 260, occupancyRate: 65.8, raw: providerRaw }, enrichment: { fetched_at: providerFetchedAt, request_id: "provider-request", cost_cents: costCents } };
}
let rpc: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
let load: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret"); vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key"); vi.stubEnv("AIRROI_API_KEY", "test-key");
  rpc = vi.fn().mockResolvedValue({ data: { id: "lead", fresh: true, status: "processing" }, error: null });
  load = vi.fn().mockResolvedValue({ data: { id: "widget", agency_id: "agency", public_token: token, enabled: true, country: "AU", ask_phone: false, agency: { name: "Test Agency", private_key: "private" } }, error: null });
  const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: load };
  update = vi.fn().mockImplementation(() => { const chain = { eq: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) }; chain.eq.mockReturnValue(chain); return chain; });
  mocks.admin.mockReturnValue({ from: (table: string) => table === "str_calculator_widgets" ? read : { update }, rpc });
  mocks.geocode.mockResolvedValue({ latitude: -33.8, longitude: 151.2, formattedAddress: input.address, placeId: "real" });
  mocks.estimate.mockResolvedValue(providerResult());
});

describe("public calculator service", () => {
  it("stores an optional phone only when the account asks for it and never sends it to AirROI", async () => {
    load.mockResolvedValue({ data: { id: "widget", agency_id: "agency", public_token: token, enabled: true, country: "AU", ask_phone: true, agency: { name: "Test Agency" } }, error: null });
    const result = await submitCalculator(token, { ...input, phone: "0412 345 678" }, "client");
    expect(rpc.mock.calls[0][1].p_input.phone).toBe("0412 345 678");
    expect(rpc.mock.calls[0][1].p_consent_text).toContain("contact and property details");
    expect(mocks.estimate.mock.calls[0][0]).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("phone");
    await submitCalculator(token, input, "client");
    expect(rpc.mock.calls[1][1].p_input).not.toHaveProperty("phone");
  });
  it("discards submitted phone numbers when the account has disabled collection", async () => {
    await submitCalculator(token, { ...input, phone: "0412 345 678" }, "client");
    await submitCalculator(token, input, "client");
    expect(rpc.mock.calls[0][1].p_input).not.toHaveProperty("phone");
    expect(rpc.mock.calls[0][1].p_input_hash).toBe(rpc.mock.calls[1][1].p_input_hash);
  });
  it("projects brand fields without exposing the agency record", async () => {
    expect(await loadPublicCalculator("bad-token")).toBeNull();
    expect((await loadPublicCalculator(token))?.brand).not.toHaveProperty("private_key");
  });
  it("reserves a lead before one standard estimate call and stores raw data separately", async () => {
    const result = await submitCalculator(token, input, "client-ip");
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.estimate.mock.invocationCallOrder[0]);
    expect(mocks.geocode).toHaveBeenCalledWith(input.address, "AU", { requireStreetAddress: true });
    expect(mocks.estimate).toHaveBeenCalledExactlyOnceWith({ latitude: -33.8, longitude: 151.2, bedrooms: 3, bathrooms: 1.5, accommodates: 6, radiusM: 2000, currency: "AUD" });
    expect(rpc.mock.calls[0][1].p_input).toMatchObject({ bedrooms: 3, bathrooms: 1.5 });
    expect(result.bathrooms).toBe(1.5);
    expect(result).not.toHaveProperty("raw");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "estimated", original_estimate_json: providerRaw, estimate_json: result }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("client-ip");
  });
  it("retains provider fetch time and exact inputs when a shared cached result creates a new lead", async () => {
    mocks.estimate.mockResolvedValue(providerResult(0));
    const startedAt = Date.now();

    const result = await submitCalculator(token, input, "client");

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_input: { email: input.email, consent: true, guests: 6, radiusM: 2000 },
      p_consent_version: "str-calculator-v2",
    });
    const saved = update.mock.calls[0][0];
    expect(saved.original_estimate_json).toEqual(providerRaw);
    expect(saved.original_estimate_json.fetched_at).toBe(providerFetchedAt);
    expect(Date.parse(saved.completed_at)).toBeGreaterThanOrEqual(startedAt);
    expect(saved.completed_at).not.toBe(saved.original_estimate_json.fetched_at);
    expect(result).not.toHaveProperty("fetched_at");
    expect(result).not.toHaveProperty("response");
  });
  it("captures separate visitors when their calculations reuse the same provider response", async () => {
    mocks.estimate.mockResolvedValue(providerResult(0));
    const secondEmail = "another-owner@example.com";
    await submitCalculator(token, input, "client-one");
    await submitCalculator(token, { ...input, email: secondEmail, requestId: "82116d24-1d73-4d7c-95b7-ef1be7545f76" }, "client-two");

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].p_input.email).toBe(input.email);
    expect(rpc.mock.calls[1][1].p_input.email).toBe(secondEmail);
    expect(rpc.mock.calls[0][1].p_input_hash).not.toBe(rpc.mock.calls[1][1].p_input_hash);
    expect(update).toHaveBeenCalledTimes(2);
    for (const [saved] of update.mock.calls) {
      expect(saved.original_estimate_json).toEqual(providerRaw);
    }
    for (const [request] of mocks.estimate.mock.calls) {
      expect(request).not.toHaveProperty("email");
      expect(request).not.toHaveProperty("consent");
    }
  });
  it("uses report-compatible guest capacity for larger properties", async () => {
    const result = await submitCalculator(token, { ...input, bedrooms: 10 }, "client");
    expect(rpc.mock.calls[0][1].p_input.guests).toBe(10);
    expect(mocks.estimate).toHaveBeenCalledWith(expect.objectContaining({ bedrooms: 10, accommodates: 10 }));
    expect(result.guests).toBe(10);
  });
  it("includes bathroom changes in the request fingerprint", async () => {
    await submitCalculator(token, input, "client");
    await submitCalculator(token, { ...input, bathrooms: 2 }, "client");
    expect(rpc.mock.calls[0][1].p_input_hash).not.toBe(rpc.mock.calls[1][1].p_input_hash);
  });
  it("replays a completed request without another paid call", async () => {
    rpc.mockResolvedValue({ data: { id: "lead", fresh: false, status: "estimated", estimate: { annualRevenue: 62400 } } });
    expect(await submitCalculator(token, input, "client")).toEqual({ annualRevenue: 62400 });
    expect(mocks.estimate).not.toHaveBeenCalled();
  });
  it("enforces rate limits before geocoding or estimating", async () => {
    rpc.mockResolvedValue({ error: { code: "PT429" } });
    await expect(submitCalculator(token, input, "client")).rejects.toMatchObject({ status: 429 });
    expect(mocks.geocode).not.toHaveBeenCalled(); expect(mocks.estimate).not.toHaveBeenCalled();
  });
  it("retains failed enquiries and hides provider errors", async () => {
    mocks.estimate.mockRejectedValue(new Error("secret upstream payload"));
    await expect(submitCalculator(token, input, "client")).rejects.toMatchObject({ status: 422, leadCaptured: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
  it("never uses mocked coordinates for a paid estimate", async () => {
    mocks.geocode.mockResolvedValue({ placeId: "mock-place-id" });
    await expect(submitCalculator(token, input, "client")).rejects.toMatchObject({ status: 422 });
    expect(mocks.estimate).not.toHaveBeenCalled();
  });
  it("does not repeat a processing or failed request", async () => {
    for (const status of ["processing", "failed"]) {
      rpc.mockResolvedValue({ data: { id: "lead", fresh: false, status, created_at: new Date().toISOString() } });
      await expect(submitCalculator(token, input, "client")).rejects.toMatchObject({ leadCaptured: true });
    }
    expect(mocks.estimate).not.toHaveBeenCalled();
  });
  it("does not capture enquiries for paused calculators", async () => {
    load.mockResolvedValue({ data: null, error: null });
    await expect(submitCalculator(token, input, "client")).rejects.toMatchObject({ status: 404 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
