import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing, ParsedListing } from "@/lib/types";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { resolveAppraisalInput } from "./resolveAppraisalInput";
import { saveAppraisalResults } from "./saveAppraisalResults";
const mocks = vi.hoisted(() => ({ rent: vi.fn(), sale: vi.fn() }));
vi.mock("@/lib/rental/enrichListingRentalAppraisal", () => ({ enrichListingRentalAppraisal: mocks.rent }));
vi.mock("@/lib/sales/enrichListingSalesAppraisal", () => ({ enrichListingSalesAppraisal: mocks.sale }));
import { enrichListingForLeaseAppraisal } from "@/lib/lease-appraisal/enrichListingForLeaseAppraisal";
import { enrichListingForSalesAppraisal } from "@/lib/sales-appraisal/enrichListingForSalesAppraisal";

const manual = () => createEmptyListingDraft({ id: "qa-listing", agency_id: "qa-agency", property_address: "1 Test Street", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 3, bathrooms: 2, property_type: "House", updated_at: "2026-10-09T00:00:00Z" });
function database(listing: Listing) {
  const state = { listing: structuredClone(listing), conflict: false, error: null as null | {message: string}, writes: [] as Record<string, unknown>[], filters: [] as [string, unknown][] };
  const supabase = { from: () => {
    let patch: Record<string, unknown>;
    const q = {
      update: (value: Record<string, unknown>) => { patch=value; return q; },
      eq: (key: string, value: unknown) => { state.filters.push([key,value]); return q; },
      select: () => q,
      maybeSingle: async () => {
        if (state.error) return { data: null, error: state.error };
        if (state.conflict) return { data: null, error: null };
        state.writes.push(patch); state.listing={...state.listing,...patch};
        return { data: state.listing, error: null };
      },
    };return q;
  } } as unknown as SupabaseClient;
  return { state, supabase };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rent.mockImplementation(async (input: ParsedListing) => ({ ...input, rentalAppraisal: { weeklyMin: 800, weeklyMax: 1000, weeklyMidpoint: 900, compCount: 1 }, rentalComps: [{ address: "2 Test Street", weeklyRent: 900, bedrooms: 3, propertyType: "House", listingUrl: "https://example.com/rental" }] }));
  mocks.sale.mockImplementation(async (input: ParsedListing) => ({ ...input, salesAppraisal: { priceMin: 900000, priceMax: 1100000, priceMidpoint: 1000000, compCount: 1 }, salesComps: [{ address: "2 Test Street", price: 1000000, saleStatus: "for_sale", bedrooms: 3, propertyType: "House", listingUrl: "https://example.com/sale" }] }));
});

for (const [kind, enrich, provider] of [["lease",enrichListingForLeaseAppraisal,mocks.rent],["sales",enrichListingForSalesAppraisal,mocks.sale]] as const) {
 describe(`${kind} live-service boundary`, () => {
  it("passes manual facts to the provider and returns reloadable saved evidence", async () => {
    const listing=manual(), db=database(listing);
    const result=await enrich({supabase:db.supabase,listing});
    expect(provider.mock.calls[0][0]).toMatchObject({suburb:"Bondi",state:"NSW",postcode:"2026",bedrooms:3});
    expect(result.listing.scraped_listing_json?.suburb).toBeUndefined();
    const view=resolveAppraisalInput(structuredClone(result.listing));
    expect(kind === "lease" ? view.rentalAppraisal?.weeklyMidpoint : view.salesAppraisal?.priceMidpoint).toBe(kind === "lease" ? 900 : 1000000);
    expect(db.state.filters).toContainEqual(["agency_id","qa-agency"]);
    expect(db.state.filters).toContainEqual(["updated_at",listing.updated_at]);
  });
  it("rejects missing fields before calling a provider or writing", async () => {
    const listing={...manual(),postcode:null},db=database(listing);
    await expect(enrich({supabase:db.supabase,listing})).rejects.toThrow("Add postcode");
    expect(provider).not.toHaveBeenCalled();expect(db.state.writes).toHaveLength(0);
  });
  it("cannot overwrite newer edits when a background result arrives", async () => {
    const listing=manual(),db=database(listing);db.state.conflict=true;
    await expect(enrich({supabase:db.supabase,listing})).rejects.toThrow("Property details changed");
    expect(db.state.writes).toHaveLength(0);
  });
  it("does not report a failed provider refresh as completed", async () => {
    const listing=manual(),db=database(listing);
    provider.mockImplementation(async (input: ParsedListing) => ({...input,warnings:[`${kind === "lease" ? "Rental" : "Sales"} appraisal failed: Provider unavailable`]}));
    await expect(enrich({supabase:db.supabase,listing})).rejects.toThrow("Provider unavailable");
    expect(db.state.writes).toHaveLength(0);
  });
  it("still fails if the same failure message is already stored from an earlier attempt", async () => {
    const listing=manual(),db=database(listing),warning=`${kind === "lease" ? "Rental" : "Sales"} appraisal skipped: Provider missing`;
    listing.scraped_listing_json={images:[],agents:[],confidence:"low",warnings:[warning]};
    provider.mockImplementation(async (input: ParsedListing) => ({...input,warnings:[...input.warnings,warning]}));
    await expect(enrich({supabase:db.supabase,listing})).rejects.toThrow("Provider missing");
  });
  it("keeps an empty successful search distinct from a failed service", async () => {
    const listing=manual(),db=database(listing);
    provider.mockImplementation(async (input: ParsedListing) => input);
    const result=await enrich({supabase:db.supabase,listing});
    const view=resolveAppraisalInput(result.listing);
    expect(kind === "lease" ? view.rentalComps : view.salesComps).toBeUndefined();
    expect(db.state.writes).toHaveLength(1);
  });
 });
}
it("surfaces storage errors rather than claiming a save", async () => {
 const listing=manual(),db=database(listing);db.state.error={message:"write denied"};
 await expect(saveAppraisalResults({supabase:db.supabase,listing,kind:"lease",parsed:resolveAppraisalInput(listing)})).rejects.toThrow("write denied");
});
it("rental and sales evidence survive sequential searches on one manual listing", async () => {
 const listing=manual(),db=database(listing);
 const rent=await enrichListingForLeaseAppraisal({supabase:db.supabase,listing});
 const sale=await enrichListingForSalesAppraisal({supabase:db.supabase,listing:rent.listing});
 const view=resolveAppraisalInput(sale.listing);
 expect(view.rentalAppraisal?.weeklyMidpoint).toBe(900);
 expect(view.salesAppraisal?.priceMidpoint).toBe(1000000);
});
