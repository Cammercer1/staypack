import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { buildProspectProposal } from "@/lib/prospects/buildProposal";
import { prospectProfileSchema } from "@/lib/prospects/profile";
import ausVision from "@/lib/prospects/profiles/aus-vision-realty.json";
import propertyProviders from "@/lib/prospects/profiles/property-providers.json";
import { PropertyProvidersProposal } from "./PropertyProvidersProposal";

const id = "230936fe-e39a-437f-a772-3b4b303f9111";
const listing = createEmptyListingDraft({ property_address: "57 Garling Street", suburb: "Kardinya", state: "WA", postcode: "6163", bedrooms: 4, bathrooms: 2,
  hero_image_url: "https://example.com/house.jpg", selected_image_urls: ["https://example.com/house.jpg"] });
const estimate = { annualRevenue: 80000, nightlyRate: 400, occupancyRate: 80000 / 400 / 365 * 100, monthlyRevenue: 80000 / 12, weeklyRevenue: 80000 / 52, bookedNights: 200, radiusM: 2000, raw: {} };
function snapshot(profile: unknown) {
  return buildProspectProposal({ profile: prospectProfileSchema.parse(profile), brandId: id, proposalId: id, listing, estimate, enrichment: null, propertyOverrides: { hero_image_url: "https://example.com/house.jpg" } }).snapshot;
}

describe("shared prospect proposal branding", () => {
  it.each(["property", "appraisal", "forecast", "evidence", "service", "next-steps"])("renders the saved agency identity on %s without the previous prospect's content", page => {
    const report = snapshot(ausVision);
    const html = renderToStaticMarkup(<PropertyProvidersProposal {...report} initialPage={page} exampleAgreement />);
    expect(html).toContain("Aus Vision Realty");
    expect(html).not.toMatch(/Property Providers|Live Better|Don Binkley|Montserrat|Sydney|4\.6/);
    expect(html).toContain("Roboto");
    if (page === "appraisal") expect(html).toContain("With Aus Vision Realty");
    if (page === "service") {
      expect(html).toContain("Booking.com");
      expect(html).not.toContain("Ratings and review platforms");
    }
    if (page === "next-steps") expect(html).toContain("Lucy Deng");
  });
  it("preserves the existing Property Providers identity and proof", () => {
    const report = snapshot(propertyProviders);
    const html = renderToStaticMarkup(<PropertyProvidersProposal {...report} initialPage="service" exampleAgreement />);
    expect(html).toContain("Live Better");
    expect(html).toContain("Property Providers");
    expect(html).toContain("4.6");
    expect(html).toContain("RateMyAgent");
    expect(html).not.toContain("Aus Vision Realty");
  });
});
