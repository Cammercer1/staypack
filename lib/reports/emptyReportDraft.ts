import type { Report } from "@/lib/types";

export function createEmptyReportDraft(overrides: Partial<Report> = {}): Report {
  const now = new Date(0).toISOString();

  return {
    id: "",
    agency_id: "",
    agent_profile_id: null,
    created_by: null,
    status: "draft",
    listing_url: null,
    property_address: null,
    suburb: null,
    state: null,
    postcode: null,
    country: null,
    latitude: null,
    longitude: null,
    property_type: null,
    bedrooms: null,
    bathrooms: null,
    car_spaces: null,
    accommodates: null,
    listing_title: null,
    listing_description: null,
    display_price: null,
    hero_image_url: null,
    selected_image_urls: null,
    uploaded_image_urls: null,
    public_slug: null,
    public_url: null,
    qr_code_url: null,
    pdf_url: null,
    scraped_listing_json: null,
    raw_airbtics_json: null,
    original_estimate_json: null,
    user_overrides_json: null,
    final_estimate_json: null,
    ai_copy_json: null,
    final_report_json: null,
    template_id: null,
    error_message: null,
    generated_at: null,
    published_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function isPersistedReport(report: Pick<Report, "id">) {
  return Boolean(report.id);
}
