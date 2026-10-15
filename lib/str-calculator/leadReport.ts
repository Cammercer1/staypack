import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { airroiInputSchema, normaliseAirroiResponse } from "@/lib/airroi/client";
import { fetchAirroiMarketOccupancy } from "@/lib/airroi/marketOccupancy";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPropertyCountry } from "@/lib/property-market/agencyCountry";
import { countryName, marketForCountry } from "@/lib/property-market";
import { applyStrEstimateAdjustments, initialStrManagementScenario, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import type { Agency, StrEnrichmentJson, StrEstimate, StrEstimateOverrides } from "@/lib/types";
import { calculatorAssumptions } from "./schema";
import { calculatorLeadAddress } from "./leadAddress";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const storedRawSchema = z.object({ provider: z.literal("airroi"), input: airroiInputSchema, response: z.unknown() }).passthrough();
const bathroomsSchema = z.number().min(0.5).max(20).multipleOf(0.5);

export type CalculatorReportLead = {
  id: string; agency_id: string; report_id: string | null; address: string; bedrooms: number;
  country: "AU" | "US"; status: "processing" | "estimated" | "failed";
  input_json: { bathrooms?: unknown } | null; original_estimate_json: unknown; completed_at: string | null;
};

export class CalculatorReportError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Only a new draft receives this snapshot. No provider calls or report writes occur here. */
export function calculatorLeadReportDraft(lead: CalculatorReportLead, agency: Agency, now = Date.now()) {
  const country = assertPropertyCountry(agency, lead);
  const raw = storedRawSchema.safeParse(lead.original_estimate_json);
  const suppliedBathrooms = bathroomsSchema.safeParse(lead.input_json?.bathrooms);
  const bathrooms = suppliedBathrooms.success ? suppliedBathrooms.data : 1;
  const input = raw.success && raw.data.input.bedrooms === lead.bedrooms && raw.data.input.accommodates <= 10
    && raw.data.input.bathrooms === bathrooms && raw.data.input.currency === marketForCountry(country).currency
    ? raw.data.input : null;
  const property = {
    ...calculatorLeadAddress(lead.address, country), country: countryName(country), bedrooms: lead.bedrooms, bathrooms,
    accommodates: input?.accommodates ?? calculatorAssumptions(lead.bedrooms).guests,
    latitude: input?.latitude ?? null, longitude: input?.longitude ?? null,
  };
  const overrides: StrEstimateOverrides = {
    estimateInputs: { bedrooms: property.bedrooms, bathrooms: property.bathrooms, accommodates: property.accommodates },
  };
  const draft: {
    source_address: string;
    property: typeof property; original_estimate: StrEstimate | null; final_estimate: StrEstimate | null;
    enrichment: StrEnrichmentJson | null; overrides: StrEstimateOverrides; fetched_at: string | null;
  } = { source_address: lead.address, property, original_estimate: null, final_estimate: null, enrichment: null, overrides, fetched_at: null };

  if (lead.status !== "estimated" || !raw.success || !input) return draft;
  // A cached submission may have completed today using a result fetched weeks ago.
  // Only pre-cache leads without provenance can fall back to their completion time.
  const fetchedAt = Object.hasOwn(raw.data, "fetched_at") ? raw.data.fetched_at : lead.completed_at;
  const fetchedTime = typeof fetchedAt === "string" ? Date.parse(fetchedAt) : NaN;
  if (!Number.isFinite(fetchedTime) || fetchedTime > now || now - fetchedTime >= THIRTY_DAYS) return draft;
  try {
    const { estimate, enrichment } = normaliseAirroiResponse(raw.data.response, input);
    estimate.raw = { ...raw.data, fetched_at: fetchedAt };
    const scenario = initialStrManagementScenario(estimate, agency.str_management_presets);
    draft.original_estimate = estimate;
    draft.final_estimate = scenario ? applyStrEstimateAdjustments(estimate, scenario.rates) : estimate;
    draft.overrides = saveStrRateOverride(overrides, scenario?.rates ?? null, scenario?.assumptions);
    draft.fetched_at = fetchedAt as string;
    draft.enrichment = { ...enrichment, fetched_at: draft.fetched_at, cost_cents: 0, cache_status: "hit",
      request_id: typeof raw.data.request_id === "string" ? raw.data.request_id : null };
  } catch {
    // Invalid or unavailable old provider payloads still allow a property draft.
    return { ...draft, original_estimate: null, final_estimate: null, enrichment: null, overrides, fetched_at: null };
  }
  return draft;
}

export async function createReportFromCalculatorLead({ leadId, agency, userId, admin = createAdminClient() }: {
  leadId: string; agency: Agency; userId: string; admin?: SupabaseClient;
}) {
  const { data, error } = await admin.from("str_calculator_leads")
    .select("id,agency_id,report_id,address,bedrooms,country,status,input_json,original_estimate_json,completed_at")
    .eq("id", leadId).eq("agency_id", agency.id).maybeSingle();
  if (error) throw new CalculatorReportError("Couldn’t load this enquiry. Please try again.", 503);
  if (!data) throw new CalculatorReportError("Calculator enquiry not found.", 404);
  const lead = data as CalculatorReportLead;
  // Even replays go through the atomic RPC's ownership checks, but do not rebuild
  // a saved report's estimates, template or customer details from current settings.
  const draft = lead.report_id ? null : calculatorLeadReportDraft(lead, agency);
  const templateId = draft ? (await resolveAvailableTemplates(agency, "str")).defaultTemplateId : null;
  if (draft?.original_estimate && draft.enrichment) {
    // Complete only this new draft's missing market evidence. The calculator
    // baseline, comparable pool, selected IDs and original fetch date stay intact.
    // Provider failures return an unavailable snapshot with the normal fallback.
    const saved = storedRawSchema.parse(draft.original_estimate.raw);
    const occupancy = await fetchAirroiMarketOccupancy(saved.input, draft.property);
    draft.enrichment = { ...draft.enrichment, market_occupancy: occupancy, cost_cents: occupancy.cost_cents };
  }
  const result = await admin.rpc("create_str_calculator_lead_report", {
    p_agency_id: agency.id, p_lead_id: leadId, p_user_id: userId, p_template_id: templateId, p_draft: draft,
  });
  if (result.error) throw new CalculatorReportError("Couldn’t create the report. Please try again.", 503);
  return z.object({ report_id: z.uuid(), created: z.boolean(), estimate_reused: z.boolean() }).parse(result.data);
}
