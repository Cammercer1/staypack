import { blurbBlocksToPlainText, getBlurbBlocks } from "@/lib/collateral/sales-brochure/blurbBlocks";
import { getPropertyHighlights } from "@/lib/collateral/sales-brochure/propertyHighlights";
import {
  resolveBrochurePrice,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import type { FinalReportJson } from "@/lib/types";

/** Maps brochure document to report preview shape for shared Classic layout components. */
export function salesBrochureToReportShape(
  document: BrochureDocumentJson,
): FinalReportJson {
  const { agency, property, copy, agent, agents } = document;

  return {
    version: "standard_2_page_v1",
    template_id: document.template_id,
    generated_at: document.generated_at,
    agency: {
      name: agency.name,
      logo_url: agency.logo_url,
      logo_light_url: agency.logo_light_url,
      logo_dark_url: agency.logo_dark_url,
      primary_colour: agency.primary_colour,
      secondary_colour: agency.secondary_colour,
      accent_colour: agency.accent_colour,
      text_colour: agency.text_colour,
      background_colour: agency.background_colour,
      heading_font_family: agency.heading_font_family,
      body_font_family: agency.body_font_family,
      font_family: agency.font_family,
      heading_font_file_url: agency.heading_font_file_url,
      body_font_file_url: agency.body_font_file_url,
      font_file_url: agency.font_file_url,
      website_url: agency.website_url,
      phone: agency.phone,
      email: agency.email,
      brand_advanced: agency.brand_advanced ?? null,
    },
    agent,
    agents,
    property: {
      address: property.address,
      suburb: property.suburb,
      state: property.state,
      postcode: property.postcode,
      summary: property.summary,
      property_type: property.property_type,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      car_spaces: property.car_spaces,
      accommodates: 0,
      listing_url: "",
      hero_image_url: property.hero_image_url,
      selected_image_urls: property.page_one_image_urls.filter(
        (url) => url !== property.hero_image_url,
      ),
      display_price: resolveBrochurePrice(document),
    },
    str: {
      annual_revenue: null,
      monthly_revenue: null,
      weekly_revenue: null,
      nightly_rate: null,
      occupancy_rate: null,
      booked_nights: null,
      radius_m: null,
    },
    ltr: {
      weekly_min: null,
      weekly_max: null,
      weekly_midpoint: null,
      annual_midpoint: null,
      difference_before_costs: null,
    },
    copy: {
      heading: copy.heading,
      blurb: blurbBlocksToPlainText(getBlurbBlocks(copy)) || copy.blurb,
      key_metrics_line: "",
      appeal_points: getPropertyHighlights(copy),
      supporting_factors: [],
      buyer_checks: [],
      methodology_note: "",
      disclaimer: copy.disclaimer,
      comparable_evidence: "",
      comparable_disclaimer: "",
      cta: copy.inspection_cta,
    },
    assets: {
      qr_code_url: document.assets.qr_code_url,
      pdf_url: "",
    },
  };
}
