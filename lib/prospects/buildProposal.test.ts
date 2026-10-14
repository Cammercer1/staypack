import { describe, expect, it } from "vitest";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { DEFAULT_STR_MANAGEMENT_ASSUMPTIONS } from "@/lib/reports/strEstimateAdjustments";
import { prospectProfileSchema } from "./profile";
import { buildProspectProposal } from "./buildProposal";

const id = "230936fe-e39a-437f-a772-3b4b303f9111";
const profile = prospectProfileSchema.parse({ slug: "sample-brand", name: "Prospect Brand",
  brand: { displayName: "Prospect Brand", logo_url: "https://example.com/logo.svg" },
  upliftPercent: 25, assumptions: DEFAULT_STR_MANAGEMENT_ASSUMPTIONS,
  assignment: { name: "Sample design", version: 1, defaults: DEFAULT_PROPOSAL_DRAFT }, sources: [] });
const listing = createEmptyListingDraft({ property_address: "6/33 Malvern Avenue", suburb: "Manly", state: "NSW", postcode: "2095", bedrooms: 2, bathrooms: 2,
  hero_image_url: "https://example.com/house.jpg", selected_image_urls: ["https://example.com/house.jpg"],
  scraped_listing_json: { images: [], agents: [{ name: "Unrelated selling agent", email: "private@example.com" }], warnings: [], confidence: "high" } });
const estimate = { annualRevenue: 80000, nightlyRate: 400, occupancyRate: 80000 / 400 / 365 * 100, monthlyRevenue: 80000 / 12, weeklyRevenue: 80000 / 52, bookedNights: 200, radiusM: 2000, raw: { privateProviderData: true } };

describe("detached prospect proposals", () => {
  it("applies the uplift once and freezes branding without exposing provider payloads or selling agents", () => {
    const input = structuredClone(profile);
    const result = buildProspectProposal({ profile: input, brandId: id, proposalId: id, listing, estimate, enrichment: null, propertyOverrides: { car_spaces: 1 } });
    expect(result.snapshot.data.str.market.annualRevenue).toBe(80000);
    expect(result.snapshot.data.str.managed.annualRevenue).toBe(100000);
    expect(result.overrides.strManagement?.presetUpliftPercent).toBe(25);
    expect(result.snapshot.data.agency.name).toBe("Prospect Brand");
    expect(result.snapshot.data.agents).toEqual([]);
    expect(result.snapshot.data.property.carSpaces).toBe(1);
    expect(result.overrides.property.car_spaces).toBe(1);
    expect(listing.car_spaces).toBeNull();
    expect(JSON.stringify(result.snapshot)).not.toMatch(/privateProviderData|private@example.com|Unrelated selling agent/);
    expect(result.snapshot.data.disclaimer).not.toMatch(/25%|illustrative|example|scenario/i);
    input.name = "Changed later";
    expect(result.snapshot.data.agency.name).toBe("Prospect Brand");
    expect(estimate.annualRevenue).toBe(80000);
  });
  it("rejects customer agent and attachment references", () => {
    expect(prospectProfileSchema.safeParse({ ...profile, assignment: { ...profile.assignment, defaults: { ...profile.assignment.defaults, agentIds: [id] } } }).success).toBe(false);
    expect(prospectProfileSchema.safeParse({ ...profile, assignment: { ...profile.assignment, defaults: { ...profile.assignment.defaults, attachmentIds: [id] } } }).success).toBe(false);
  });
  it("includes only the detached profile's explicitly supplied public contacts", () => {
    const contact = { name: "Prospect principal", role: "Principal", phone: "+61 2 1234 5678", email: "hello@example.com", photoUrl: "https://example.com/portrait.jpg" };
    const input = { ...structuredClone(profile), contacts: [contact] };
    const result = buildProspectProposal({ profile: input, brandId: id, proposalId: id, listing, estimate, enrichment: null });
    expect(result.snapshot.data.agents).toEqual([contact]);
    contact.name = "Edited later";
    expect(result.snapshot.data.agents[0].name).toBe("Prospect principal");
    expect(JSON.stringify(result.snapshot)).not.toContain("private@example.com");
  });
  it("does not fabricate a sample when the market benchmark is missing", () => {
    expect(() => buildProspectProposal({ profile, brandId: id, proposalId: id, listing, estimate: { ...estimate, annualRevenue: null }, enrichment: null })).toThrow("valid market estimate");
  });
});
