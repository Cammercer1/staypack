import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/geocoding", () => ({ hasGeocodableAddress: () => false, geocodeReportAddress: vi.fn() }));
import { prepareListingInput as prepareCreate, prepareListingPatch as preparePatch } from "./prepareListingInput";
import { updateListingSchema } from "@/lib/validation/schemas";
import type { Listing, ParsedListing } from "@/lib/types";
const prepareListingInput = (body: unknown) => prepareCreate(updateListingSchema.parse(body));
const prepareListingPatch = (body: unknown, listing: Listing) => preparePatch(updateListingSchema.parse(body), listing);
import { createEmptyListingDraft } from "./emptyListingDraft";
import { hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";

const existing = createEmptyListingDraft({ property_address: "1 Test Street", suburb: "Bondi", state: "NSW", postcode: "2026", bedrooms: 3, scraped_listing_json: { images: [], agents: [], warnings: [], confidence: "high", rentalAppraisal: { compCount: 2, weeklyMidpoint: 800 }, rentalComps: [{ address: "2 Test Street", weeklyRent: 800 }], salesAppraisal: { compCount: 2, priceMidpoint: 1000000 }, salesComps: [], leaseAppraisalEnrichment: { status: "completed", requestId: "qa", updatedAt: "2026-10-09" } } });
describe("listing edits retain market evidence", () => {
 it("changing agents preserves every unrelated stored field", async () => {
   const { prepared } = await prepareListingPatch({ listing_agents: [{ name: "New agent" }] }, existing);
   expect(prepared.scraped_listing_json).toEqual({ ...existing.scraped_listing_json, agents: [{ name: "New agent" }] });
 });
 it("a normal property save also preserves results when it includes agents", async () => {
   const { prepared } = await prepareListingPatch({ suburb: "Bondi", bedrooms: 3, listing_agents: [] }, existing);
   expect((prepared.scraped_listing_json as ParsedListing)?.rentalAppraisal).toEqual(existing.scraped_listing_json?.rentalAppraisal);
   expect((prepared.scraped_listing_json as ParsedListing)?.salesAppraisal).toEqual(existing.scraped_listing_json?.salesAppraisal);
 });
 it("omitted price fields do not mark legacy evidence stale on an agent-only save", async () => {
   const priced = { ...existing, display_price: "$1,250,000" };
   const { prepared } = await prepareListingPatch({ listing_agents: [{ name: "New agent" }] }, priced);
   expect((prepared.scraped_listing_json as ParsedListing)?.appraisalInputFingerprints).toBeUndefined();
 });
 it("marks legacy evidence stale when saved subject fields change", async () => {
   const { prepared } = await prepareListingPatch({ bedrooms: 4 }, existing);
   const changed = { ...existing, ...prepared } as typeof existing;
   expect(hasStaleAppraisal(changed, "lease")).toBe(true);
   expect(hasStaleAppraisal(changed, "sales")).toBe(true);
   expect((prepared.scraped_listing_json as ParsedListing)?.rentalComps).toEqual(existing.scraped_listing_json?.rentalComps);
 });
 it("preserves submitted imported fields when agents accompany creation", async () => {
   const { prepared } = await prepareListingInput({ scraped_listing_json: { suburb: "Bondi", images: [], agents: [], warnings: [], confidence: "high" }, listing_agents: [{ name: "QA agent" }] });
   expect(prepared.scraped_listing_json?.suburb).toBe("Bondi");
 });
 it("does not certify already-stale legacy evidence when edits are changed and reverted", async () => {
   const corrected = { ...existing, scraped_listing_json: { ...existing.scraped_listing_json!, bedrooms: 2 } };
   expect(hasStaleAppraisal(corrected, "lease")).toBe(true);
   const { prepared } = await prepareListingPatch({ bedrooms: 4 }, corrected);
   const changed = { ...corrected, ...prepared } as Listing;
   const { prepared: restored } = await prepareListingPatch({ bedrooms: 3 }, changed);
   expect(hasStaleAppraisal({ ...changed, ...restored } as Listing, "lease")).toBe(true);
   expect(hasStaleAppraisal({ ...changed, ...restored } as Listing, "sales")).toBe(true);
 });
});
