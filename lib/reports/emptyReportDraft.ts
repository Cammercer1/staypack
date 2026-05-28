import type { Report } from "@/lib/types";

export function createEmptyReportDraft(overrides: Partial<Report> = {}): Report {
  const now = new Date(0).toISOString();

  return {
    id: "",
    agency_id: "",
    listing_id: "",
    created_by: null,
    status: "draft",
    public_slug: null,
    public_url: null,
    qr_code_url: null,
    pdf_url: null,
    raw_airbtics_json: null,
    airbtics_tier: null,
    airbtics_report_id: null,
    str_enrichment_json: null,
    airbtics_cost_cents: null,
    airbtics_fetched_at: null,
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
