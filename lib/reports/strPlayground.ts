import { PLAYGROUND_BROCHURE_IMAGES } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { CLASSIC_DETAILED_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import type { FinalReportJson } from "@/lib/types";

/** Mock STR report for /dev/templates when no reportId is provided. */
export function getStrPlaygroundReport(): FinalReportJson {
  const images = [...PLAYGROUND_BROCHURE_IMAGES].slice(0, 5);

  return {
    version: "str_v1",
    template_id: CLASSIC_DETAILED_TEMPLATE_ID,
    generated_at: new Date().toISOString(),
    agency: {
      name: "Sample Agency",
      logo_url: "",
      logo_light_url: "",
      logo_dark_url: "",
      primary_colour: "#002e36",
      secondary_colour: "#f9f5ea",
      accent_colour: "#e8efe3",
      text_colour: "#002e36",
      callout_heading_colour: "#ffffff",
      callout_text_colour: "#ffffff",
      background_colour: "#f9f5ea",
      heading_font_family: "fraunces",
      body_font_family: "inter",
      font_family: "inter",
      heading_font_file_url: "",
      body_font_file_url: "",
      font_file_url: "",
      website_url: "https://example.com",
      phone: "02 9000 1234",
      email: "hello@example.com",
      brand_advanced: null,
    },
    agent: {
      name: "Harvey Specter",
      role_title: "Licensed Real Estate Agent",
      phone: "0419 290 030",
      email: "harvey@example.com",
      photo_url: "",
    },
    agents: [],
    property: {
      address: "42 Ocean Parade, Burleigh Heads",
      suburb: "Burleigh Heads",
      state: "QLD",
      postcode: "4220",
      summary: "Family home · 4 bed · near beach",
      property_type: "House",
      bedrooms: 4,
      bathrooms: 2,
      car_spaces: 2,
      accommodates: 8,
      listing_url: "",
      hero_image_url: images[0],
      selected_image_urls: images,
      display_price: "$1,250,000",
    },
    str: {
      annual_revenue: 98500,
      monthly_revenue: 8208,
      weekly_revenue: 1894,
      nightly_rate: 285,
      occupancy_rate: 0.72,
      booked_nights: 263,
      radius_m: 2000,
    },
    str_yield: null,
    ltr: {
      weekly_min: null,
      weekly_max: null,
      weekly_midpoint: null,
      annual_midpoint: null,
      difference_before_costs: null,
    },
    copy: {
      heading: "Coastal family home with strong short-term rental appeal",
      blurb:
        "A well-presented four-bedroom home combining open-plan living, covered alfresco and practical indoor-outdoor flow. Moments from Burleigh beach, cafes and schools.\n\nShort-term rental demand in this pocket remains resilient, with strong weekend occupancy and premium nightly rates during peak season.",
      key_metrics_line:
        "Based on comparable short-term listings within 2km. Estimates are indicative only.",
      appeal_points: [
        "Walk to patrolled beach and village dining",
        "Dual living zones with covered outdoor entertaining",
        "Strong historical occupancy in comparable listings",
      ],
      supporting_factors: [],
      buyer_checks: [],
      methodology_note: "",
      disclaimer:
        "Estimated gross short-term rental revenue before costs. Not a valuation or income guarantee.",
      comparable_evidence: "",
      comparable_disclaimer: "",
      cta: "",
    },
    str_enrichment: {
      tier: "full",
      comp_count: 12,
      radius_m: 2000,
      revenue_range: {
        p25: 82000,
        p50: 98500,
        p75: 112000,
        p90: 128000,
      },
      seasonality: [],
      comps: [],
    },
    ltr_enrichment: null,
    assets: {
      qr_code_url: "",
      pdf_url: "",
    },
  };
}
