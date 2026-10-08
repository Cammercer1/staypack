import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import type { Agency, AgentProfile, CollateralItem, LeadWithListing, Listing } from "@/lib/types";

/** Synthetic records only. Never load an account or listing in this playground. */
export function createLintRegressionFixtures() {
  const document = structuredClone(createPlaygroundSalesBrochureDocument());
  const timestamp = "2026-10-08T00:00:00.000Z";
  const agency: Agency = {
    ...document.agency, id: "mock-agency", slug: "mock-agency", slug_aliases: [],
    logo_light_url: document.agency.logo_light_url ?? null,
    logo_dark_url: document.agency.logo_dark_url ?? null,
    callout_heading_colour: null, callout_text_colour: null,
    heading_font_file_url: null, body_font_file_url: null, font_file_url: null,
    default_report_title: "Mock report", default_cta: "Contact the mock agency",
    default_disclaimer: document.copy.disclaimer, report_template_id: "classic_detailed",
    collateral_template_defaults: {}, brand_advanced_json: null, created_at: timestamp, updated_at: timestamp,
  };
  const agent: AgentProfile = {
    ...document.agent, id: "mock-agent", agency_id: agency.id, is_default: true,
    email: "harvey@example.test", phone: "0400000000", created_at: timestamp, updated_at: timestamp,
  };
  const listing: Listing = {
    id: "mock-listing", agency_id: agency.id, created_by: null, agent_profile_id: agent.id,
    status: "active", listing_purpose: "sale", listing_url: "https://example.test/property",
    property_address: document.property.address, suburb: "Manly", state: "NSW", postcode: "2095", country: "AU",
    latitude: null, longitude: null, property_type: "house", bedrooms: 4, bathrooms: 2, car_spaces: 2, accommodates: 8,
    listing_title: "Mock coastal home", listing_description: document.copy.blurb,
    display_price: "$2,450,000", bond: null, hero_image_url: document.property.hero_image_url,
    selected_image_urls: document.property.selected_image_urls, uploaded_image_urls: [],
    collateral_image_selections: {}, listing_image_meta: {},
    scraped_listing_json: { confidence: "high", warnings: [], images: document.property.selected_image_urls, agents: [{ ...document.agent, email: "harvey@example.test", phone: "0400000000" }] },
    public_slug: "mock", public_url: null, custom_landing_url: null, landing_qr_code_url: null,
    landing_published_at: timestamp, landing_template: null, created_at: timestamp, updated_at: timestamp,
  };
  const collateral: CollateralItem = {
    id: "mock-collateral", listing_id: listing.id, agency_id: agency.id, type: "sales_brochure", status: "generated",
    report_id: null, template_id: document.template_id, document_json: document,
    public_slug: null, public_url: null, pdf_url: null, qr_code_url: null, generated_at: timestamp, published_at: null,
    created_at: timestamp, updated_at: timestamp,
  };
  const lead: LeadWithListing = {
    id: "mock-lead", listing_id: listing.id, agency_id: agency.id, name: "Mock Buyer", email: "buyer@example.test",
    phone: null, status: "new", source: "landing_page", created_at: timestamp, updated_at: timestamp,
    listings: { id: listing.id, listing_title: listing.listing_title, property_address: listing.property_address, public_slug: "mock", status: "active" },
  };
  return { document, agency, agent, listing, collateral, lead };
}

export type RegressionFixtures = ReturnType<typeof createLintRegressionFixtures>;

/** Intercepts every app API request before the real components mount. No fall-through for APIs. */
export function installRegressionMocks(fixtures: RegressionFixtures, onRequest: (label: string) => void) {
  const original = window.fetch;
  const data = structuredClone(fixtures);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (!url.pathname.startsWith("/api/")) return original(input, init);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const label = `${method} ${url.pathname}`;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    // The delay exercises loading indicators and cancellation without network access.
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    onRequest(label);
    if (url.pathname === "/api/agents") {
      return Response.json(method === "GET" ? { agents: [data.agent] } : { agent: { ...data.agent, ...body } });
    }
    if (url.pathname === "/api/analytics/overview") return Response.json({ views: 240, leads: 12 });
    if (url.pathname === "/api/google-fonts") return Response.json({ fonts: [{ family: "Mock Sans", category: "sans-serif" }] });
    if (url.pathname === "/api/agencies") {
      data.agency = { ...data.agency, ...body };
      return Response.json({ agency: data.agency });
    }
    if (url.pathname === "/api/listings/mock-listing") {
      data.listing = { ...data.listing, ...body, updated_at: new Date().toISOString(),
        scraped_listing_json: { ...data.listing.scraped_listing_json!, ...(body.listing_agents ? { agents: body.listing_agents } : {}) } };
      return Response.json({ listing: data.listing });
    }
    if (url.pathname === "/api/collateral/preview-brand") return Response.json({ agency: data.document.agency, agent: data.document.agent });
    if (url.pathname === "/api/collateral/mock-collateral") {
      data.document = { ...data.document, template_id: body.template_id ?? data.document.template_id,
        copy: { ...data.document.copy, ...body.copy }, property: { ...data.document.property, ...body.property } };
      data.collateral = { ...data.collateral, ...body, document_json: data.document };
      return Response.json({ collateral: data.collateral });
    }
    if (url.pathname === "/api/leads") return Response.json({ leads: [data.lead] });
    if (url.pathname === "/api/leads/mock-lead") {
      data.lead = { ...data.lead, ...body };
      return Response.json({ lead: data.lead });
    }
    onRequest(`BLOCKED ${label}`);
    return Response.json({ error: `No mock configured for ${label}` }, { status: 501 });
  };
  return () => { window.fetch = original; };
}
