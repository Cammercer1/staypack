import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import type { ParsedListing } from "@/lib/types";
const mocks = vi.hoisted(() => ({ access: vi.fn(), enrich: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireListingAccess: mocks.access, requireAgency: vi.fn() }));
vi.mock("@/lib/rental/enrichListingRentalAppraisal", () => ({ enrichListingRentalAppraisal: mocks.enrich }));
vi.mock("@/lib/scraping/extractListing", () => ({ extractListingFromUrl: vi.fn() }));
import { POST } from "@/app/api/listings/rental-appraisal/route";

const id = "11111111-1111-4111-8111-111111111111";
const listing = createEmptyListingDraft({ id, agency_id: "qa", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 3, listing_purpose: "sale" });
const request = () => new Request("https://example.test/api/listings/rental-appraisal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: id }) });
let update: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  update = vi.fn();
  const query = { update, eq: () => query, select: () => query, maybeSingle: async () => ({ data: { ...listing, ...update.mock.calls[0]?.[0] }, error: null }) };
  update.mockReturnValue(query);
  mocks.access.mockResolvedValue({ listing, supabase: { from: () => query } });
  mocks.enrich.mockImplementation(async (input: ParsedListing) => ({ ...input, rentalAppraisal: { weeklyMin: 800, weeklyMax: 1000, weeklyMidpoint: 900, compCount: 1 }, rentalComps: [] }));
});
describe("alternate rental appraisal endpoint", () => {
  it("accepts manual input and saves results without imported property facts", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mocks.enrich.mock.calls[0][0]).toMatchObject({ suburb: "Bondi", bedrooms: 3 });
    expect(body.savedListing.scraped_listing_json.suburb).toBeUndefined();
    expect(body.savedListing.scraped_listing_json.rentalAppraisal.weeklyMidpoint).toBe(900);
  });
  it("returns a precise validation response without calling a provider", async () => {
    mocks.access.mockResolvedValue({ listing: { ...listing, postcode: null } });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Add postcode");
    expect(mocks.enrich).not.toHaveBeenCalled();
  });
  it("does not save or claim success when the provider reports failure", async () => {
    mocks.enrich.mockImplementation(async (input: ParsedListing) => ({ ...input, warnings: ["Rental appraisal failed: Provider unavailable"] }));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Provider unavailable");
    expect(update).not.toHaveBeenCalled();
  });
});
