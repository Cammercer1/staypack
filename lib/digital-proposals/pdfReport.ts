import { resolveSalesAppraisalCopyDisclaimers } from "@/lib/sales-appraisal/salesAppraisalDisclaimer";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import { propertyMarketSchema } from "@/lib/property-market/schema";
import { z } from "zod";
import { strManagementAssumptionsSchema } from "@/lib/reports/strEstimateAdjustments";
import type { FinalReportJson } from "@/lib/types";
import { assetUrlSchema, type ProposalAgent } from "./data";

const figure = z.number().finite().nullable();
const range = z.object({ p25: figure, p50: figure, p75: figure, p90: figure });
const agent = z.object({ name: z.string(), role_title: z.string(), phone: z.string(), email: z.string(), photo_url: assetUrlSchema });
const blankAgent = { name: "", role_title: "", phone: "", email: "", photo_url: "" };

/** Frozen, printable fields only. Never retain provider payloads, the unused comp pool or draft links. */
export const proposalPdfReportSchema = z.object({
  market: propertyMarketSchema.optional(),
  recipient: z.object({ displayName: z.string().trim().min(1) }).optional(),
  version: z.string(), template_id: z.string().refine(id => id === "haven-properties-str" || isLeaseAppraisalTemplateId(id) || isSalesAppraisalTemplateId(id)), generated_at: z.iso.datetime(),
  agent_selection: z.literal("explicit"), agent, agents: z.array(agent).max(2),
  agency: z.object({
    name: z.string(), logo_url: assetUrlSchema, logo_light_url: assetUrlSchema.optional(), logo_dark_url: assetUrlSchema.optional(),
    primary_colour: z.string(), secondary_colour: z.string(), accent_colour: z.string(), text_colour: z.string(),
    callout_heading_colour: z.string().optional(), callout_text_colour: z.string().optional(), background_colour: z.string(),
    heading_font_family: z.string(), body_font_family: z.string(), font_family: z.string(),
    heading_font_file_url: assetUrlSchema, body_font_file_url: assetUrlSchema, font_file_url: assetUrlSchema,
    website_url: z.string(), phone: z.string(), email: z.string(),
  }),
  property: z.object({
    address: z.string(), suburb: z.string(), state: z.string(), postcode: z.string(), summary: z.string(), property_type: z.string(),
    bedrooms: z.number(), bathrooms: z.number(), car_spaces: z.number(), accommodates: z.number(), listing_url: assetUrlSchema,
    hero_image_url: assetUrlSchema, selected_image_urls: z.array(assetUrlSchema), estimated_value: figure.optional(), display_price: z.string().nullable().optional(), land_area_sqm: figure.optional(), floor_area_sqm: figure.optional(),
  }),
  str: z.object({ annual_revenue: figure, monthly_revenue: figure, weekly_revenue: figure, nightly_rate: figure, occupancy_rate: figure, booked_nights: figure, radius_m: figure }),
  str_scenario: z.object({ basis: z.enum(["market", "adjusted", "management"]),
    market_benchmark: z.object({ annual_revenue: figure, nightly_rate: figure, occupancy_rate: figure }),
    management: strManagementAssumptionsSchema.extend({ companyName: z.string() }).optional(),
  }).optional(),
  ltr: z.object({ market: propertyMarketSchema.optional(), weekly_min: figure, weekly_max: figure, weekly_midpoint: figure, annual_midpoint: figure, difference_before_costs: figure }),
  sale_estimate: z.object({ price_min: figure, price_max: figure, price_midpoint: figure }).optional(),
  ltr_enrichment: z.object({ comp_count: z.number(), weekly_range: z.object({ p25: figure, p50: figure, p75: figure }),
    comps: z.array(z.object({ listing_id: z.string(), name: z.string(), thumbnail_url: assetUrlSchema, listing_url: assetUrlSchema,
      bedrooms: figure, bathrooms: figure, car_spaces: figure.optional(), property_type: z.string().nullable().optional(), weekly_rent: figure, suburb: z.string().nullable() })).max(6),
    suburb_market: z.object({ suburb: z.string(), state: z.string(), postcode: figure, property_segment: z.enum(["house", "unit"]),
      vacancy_rate_pct: figure, population: figure, renter_pct: figure, gross_yield_pct: figure, median_weekly_rent: figure,
      as_of: z.string().nullable(), source: z.literal("propradar") }).nullable().optional(),
  }).nullable().optional(),
  sales_enrichment: z.object({ comp_count: z.number(), sold_comp_count: z.number(), for_sale_comp_count: z.number(),
    price_range: z.object({ p25: figure, p50: figure, p75: figure }), comps: z.array(z.object({ listing_id: z.string(), name: z.string(),
      thumbnail_url: assetUrlSchema, listing_url: assetUrlSchema, bedrooms: figure, bathrooms: figure, car_spaces: figure.optional(),
      property_type: z.string().nullable().optional(), price: figure, price_display: z.string().nullable(), sale_status: z.enum(["sold", "for_sale"]),
      sold_date: z.string().nullable(), land_area_sqm: figure.optional(), floor_area_sqm: figure.optional(), suburb: z.string().nullable(),
    })).max(6),
  }).nullable().optional(),
  copy: z.object({ heading: z.string(), blurb: z.string(), key_metrics_line: z.string(), appeal_points: z.array(z.string()),
    supporting_factors: z.array(z.string()), buyer_checks: z.array(z.string()), methodology_note: z.string(),
    disclaimer: z.string().trim().min(1), comparable_evidence: z.string(), comparable_disclaimer: z.string(), cta: z.string(),
  }),
  assets: z.object({ qr_code_url: z.literal(""), pdf_url: z.literal("") }),
  document_link: z.object({ mode: z.literal("none") }),
  str_enrichment: z.object({
    currency: z.enum(["AUD", "USD"]).optional(),
    tier: z.literal("full"), provider: z.enum(["airbtics", "airroi"]).optional(), comp_count: z.number(), radius_m: figure,
    revenue_range: range.nullable(), selected_comp_ids: z.array(z.string()).optional(), seasonality_basis: z.literal("modelled").optional(),
    seasonality: z.array(z.object({ month: z.string(), revenue_low: figure, revenue: figure, revenue_high: figure, occupancy: figure, adr: figure, modelled: z.boolean().optional() })),
    comps: z.array(z.object({ listing_id: z.string(), name: z.string(), thumbnail_url: assetUrlSchema, listing_url: assetUrlSchema,
      bedrooms: figure, bathrooms: figure, accommodates: figure, distance_m: figure, annual_revenue: figure, occupancy_rate: figure, nightly_rate: figure,
      property_type: z.string().nullable().optional(), suburb: z.string().nullable().optional(), reviews: figure.optional(), rating: figure.optional(),
      professional_management: z.boolean().nullable().optional(),
    })).max(6),
    market_occupancy: z.object({
      status: z.enum(["available", "unavailable"]),
      market: z.object({ country: z.string(), region: z.string(), locality: z.string(), district: z.string().nullable().optional() }).nullable(),
      label: z.string(), benchmark_scope: z.enum(["property_type", "all_property_types"]).optional(),
      filters: z.record(z.string(), z.object({ eq: z.union([z.string(), z.number()]) })),
      fetched_at: z.string(), request_key: z.string(), cost_cents: z.number(), sample_count: figure,
      months: z.array(z.object({ month: z.string(), average: z.number(), p25: z.number(), p50: z.number(), p75: z.number(), p90: z.number() })),
      warnings: z.array(z.string()),
    }).optional(),
  }).nullable().optional(),
});
export type ProposalPdfReport = z.infer<typeof proposalPdfReportSchema>;

export function buildProposalPdfReport(document: FinalReportJson, recipientDisplayName?: string | null): ProposalPdfReport | undefined {
  if (document.template_id !== "haven-properties-str" && !isLeaseAppraisalTemplateId(document.template_id) && !isSalesAppraisalTemplateId(document.template_id)) return undefined;
  const enrichment = document.str_enrichment;
  const source = { ...document };
  // The draft recipient is authoritative; switching to a general report must clear an old name.
  delete source.recipient;
  const displayName = recipientDisplayName?.trim();
  return proposalPdfReportSchema.parse({ ...source,
    ...(displayName ? { recipient: { displayName } } : {}),
    copy: isSalesAppraisalTemplateId(document.template_id) ? resolveSalesAppraisalCopyDisclaimers(document.copy) : document.copy,
    agent_selection: "explicit", agent: blankAgent, agents: [],
    assets: { qr_code_url: "", pdf_url: "" }, document_link: { mode: "none" },
    // The digital proposal uses the first six saved selections too.
    str_enrichment: enrichment ? { ...enrichment, comps: enrichment.comps.slice(0, 6) } : null,
  });
}

export function withPdfAgents(report: ProposalPdfReport, selected: ProposalAgent[]): ProposalPdfReport {
  const agents = selected.map(item => ({ name: item.name, role_title: item.role, phone: item.phone, email: item.email, photo_url: item.photoUrl }));
  return proposalPdfReportSchema.parse({ ...report, agent: agents[0] ?? blankAgent, agents });
}
