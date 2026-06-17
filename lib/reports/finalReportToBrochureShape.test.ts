import { describe, expect, it } from "vitest";
import { BLURB_PARAGRAPH_COUNTS } from "@/lib/copy/blurbVariantConstants";
import { mockBlurbVariantsFromText } from "@/lib/copy/blurbVariantEnforce";
import { finalReportToBrochureShape } from "@/lib/reports/finalReportToBrochureShape";
import type { FinalReportJson } from "@/lib/types";

const variants = mockBlurbVariantsFromText(
  "Paragraph one about the property.\n\nParagraph two with more detail.\n\nParagraph three closing the story.",
);

function belleReport(): FinalReportJson {
  return {
    template_id: "belle-property-str",
    generated_at: new Date().toISOString(),
    agency: {
      name: "Belle Property",
      logo_url: "",
      logo_light_url: "",
      logo_dark_url: "",
      primary_colour: "#386351",
      secondary_colour: "",
      accent_colour: "",
      text_colour: "",
      callout_heading_colour: null,
      callout_text_colour: null,
      background_colour: "#ffffff",
      heading_font_family: "",
      body_font_family: "",
      font_family: "",
      heading_font_file_url: null,
      body_font_file_url: null,
      font_file_url: null,
      website_url: "",
      phone: "",
      email: "",
      brand_advanced: null,
    },
    agent: null,
    agents: [],
    property: {
      address: "61 Bream Street, Coogee",
      suburb: "Coogee",
      state: "NSW",
      postcode: "2034",
      summary: "",
      property_type: "house",
      bedrooms: 4,
      bathrooms: 4,
      car_spaces: 2,
      accommodates: 8,
      display_price: "Auction",
      hero_image_url: "",
      selected_image_urls: [],
      listing_url: "",
    },
    estimate: {
      annual_revenue: 180000,
      monthly_revenue: 15000,
      weekly_revenue: 3462,
      nightly_rate: 500,
      occupancy_rate: 70,
      booked_nights: 255,
    },
    copy: {
      heading: "Test heading",
      blurb: variants.short,
      blurb_variants: variants,
      appeal_points: ["Feature one"],
      supporting_factors: [],
      buyer_checks: [],
      methodology_note: "",
      disclaimer: "",
      key_metrics_line: "",
      cta: "",
      comparable_evidence: "",
      comparable_disclaimer: "",
    },
    assets: { qr_code_url: "", pdf_url: "" },
  };
}

describe("finalReportToBrochureShape", () => {
  it("uses the long blurb for belle STR reports", () => {
    const document = finalReportToBrochureShape(belleReport(), "str");
    expect(document.copy.blurb_blocks).toHaveLength(
      BLURB_PARAGRAPH_COUNTS.long,
    );
    expect(document.copy.blurb).toContain("Paragraph three");
  });
});
