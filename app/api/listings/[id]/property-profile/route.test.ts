import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { hasFreshPropertyProfile, refreshPropertyProfile } from "@/lib/domain-avm/refreshPropertyProfile";
import { POST } from "./route";
vi.mock("@/lib/auth/requireUser", () => ({ requireListingAccess: vi.fn() }));
vi.mock("@/lib/domain-avm/refreshPropertyProfile", () => ({ hasFreshPropertyProfile: vi.fn(), refreshPropertyProfile: vi.fn() }));
afterEach(() => vi.resetAllMocks());
function setup(conflict = false) {
  const { listing } = createLintRegressionFixtures();
  const query = { update: vi.fn((data: Record<string, unknown>) => { void data; return query; }), eq: vi.fn(() => query), select: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: conflict ? null : listing, error: null })) };
  vi.mocked(requireListingAccess).mockResolvedValue({ listing, agency: { country_code: "AU" }, supabase: { from: () => query } } as unknown as Awaited<ReturnType<typeof requireListingAccess>>);
  vi.mocked(refreshPropertyProfile).mockResolvedValue({ ...listing.scraped_listing_json!, domainAvm: undefined, propertyLookup: { source: "domain", matchedAt: new Date().toISOString(), media: [], originalAgents: [] } });
  return { listing, query, request: (refresh = false) => POST(new Request("http://localhost/api/property-profile", { method: "POST", body: JSON.stringify({ refresh }) }), { params: Promise.resolve({ id: listing.id }) }) };
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
