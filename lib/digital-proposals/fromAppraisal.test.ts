import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { applyStrEstimateAdjustments, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";
import { proposalFromAppraisal } from "./fromAppraisal";

describe("saved appraisal preview", () => {
  it("uses saved property inputs and separate market/managed figures before a PDF exists", () => {
    const f = createLintRegressionFixtures();
    const rates = { nightlyRate: 400, occupancyRate: 70 };
    f.report.status = "estimated";
    f.report.template_id = null;
    f.report.final_report_json = null;
    f.report.updated_at = "2026-10-12T09:30:00.123456+00:00";
    f.report.final_estimate_json = applyStrEstimateAdjustments(f.report.original_estimate_json!, rates);
    f.report.user_overrides_json = {
      ...saveStrRateOverride(null, rates, { unavailableNights: 0, listingStage: "established", rationale: "Saved assumptions" }),
      strProperty: { propertyValue: 1000000, weeklyRent: 950, amenities: ["pool"], additionalAmenities: ["Tennis court"] },
    };
    const before = structuredClone(f);
    const data = proposalFromAppraisal({ ...f, agencyAgents: [f.agent] });
    expect(data.generatedAt).toBe("2026-10-12T09:30:00.123Z");
    expect(data.property).toMatchObject({ address: f.listing.property_address, bedrooms: 4, bathrooms: 2, carSpaces: 2, estimatedValue: 1000000, heroImageUrl: f.listing.hero_image_url, amenities: ["Pool", "Tennis court"] });
    expect(data.ltr).toEqual({ weeklyRent: 950, annualRent: 49400 });
    expect(data.str.market.annualRevenue).toBe(f.report.original_estimate_json!.annualRevenue);
    expect(data.str.managed.annualRevenue).toBe(102200);
    expect(data.recipient).toBeNull();
    expect(f).toEqual(before);
  });

  it("uses frozen published data even after the underlying listing changes", () => {
    const f = createLintRegressionFixtures();
    f.report.status = "published";
    const frozen = f.report.final_report_json!;
    f.listing.property_address = "Changed address";
    f.listing.hero_image_url = "https://example.test/new-photo.jpg";
    f.report.user_overrides_json = { strProperty: { propertyValue: 9999999, weeklyRent: 9999, amenities: [], additionalAmenities: [] } };
    const data = proposalFromAppraisal({ ...f, agencyAgents: [f.agent] });
    expect(data.property.address).toBe(frozen.property.address);
    expect(data.property.heroImageUrl).toBe(frozen.property.hero_image_url);
    expect(data.ltr.weeklyRent).toBe(frozen.ltr.weekly_midpoint);
    expect(data.generatedAt).toBe(frozen.generated_at);
  });

  it("passes only the named recipient display name and hides it for general appraisals", () => {
    const f = createLintRegressionFixtures();
    f.appraisal.recipient_mode = "named";
    f.appraisal.recipient_name = " Jordan ";
    f.appraisal.recipient_email = "private@example.test";
    f.appraisal.recipient_phone = "0411111111";
    f.report.updated_at = "2026-10-12T09:30:00Z";
    const data = proposalFromAppraisal({ ...f, agencyAgents: [f.agent] });
    expect(data.recipient).toEqual({ displayName: "Jordan" });
    expect(JSON.stringify(data)).not.toMatch(/private@example|0411111111|recipient_email/);
    f.appraisal.recipient_mode = "general";
    expect(proposalFromAppraisal({ ...f, agencyAgents: [f.agent] }).recipient).toBeNull();
  });
});
