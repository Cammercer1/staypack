import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/geocoding/google";
import { fetchAirroiEstimate } from "@/lib/airroi/client";
import { airroiPropertyKey } from "@/lib/airroi/propertyIdentity";
import { calculatorLeadAddress } from "./leadAddress";
import { marketForCountry } from "@/lib/property-market";
import type { Agency } from "@/lib/types";
import { calculatorBrand } from "./brand";
import { CALCULATOR_CONSENT_VERSION, calculatorAssumptions, calculatorConsent, calculatorEstimateSchema, type CalculatorEstimate, type CalculatorSettings, type CalculatorSubmission } from "./schema";

const publicBrandColumns = "name,logo_url,logo_dark_url,logo_light_url,primary_colour,background_colour,text_colour,heading_font_family,body_font_family,font_family,heading_font_file_url,body_font_file_url,font_file_url,brand_advanced_json";
export class CalculatorError extends Error {
  constructor(message: string, public status: number, public leadCaptured = false) { super(message); }
}

export async function loadPublicCalculator(token: string) {
  if (!z.uuid().safeParse(token).success) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("str_calculator_widgets")
    .select(`id,agency_id,public_token,enabled,country,ask_phone,agency:agencies(${publicBrandColumns})`)
    .eq("public_token", token).eq("enabled", true).maybeSingle();
  if (error) throw new CalculatorError("The calculator is temporarily unavailable. Please try again later.", 503);
  if (!data) return null;
  const agency = (Array.isArray(data.agency) ? data.agency[0] : data.agency) as unknown as Agency;
  if (!agency) return null;
  return { widget: data as unknown as CalculatorSettings & { agency_id: string }, brand: calculatorBrand(agency) };
}

function fingerprint(value: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new CalculatorError("The calculator is temporarily unavailable.", 503);
  return createHmac("sha256", key).update(`str-calculator:${value}`).digest("hex");
}

export async function submitCalculator(token: string, input: CalculatorSubmission, clientAddress: string) {
  const publicCalculator = await loadPublicCalculator(token);
  if (!publicCalculator) throw new CalculatorError("This calculator is currently unavailable.", 404);
  const { widget, brand } = publicCalculator;
  const admin = createAdminClient();
  const { requestId } = input;
  const phone = widget.ask_phone ? input.phone?.trim() : undefined;
  const fields = { address: input.address, bedrooms: input.bedrooms, bathrooms: input.bathrooms, email: input.email, consent: input.consent, ...(phone ? { phone } : {}) };
  const { data: reservation, error } = await admin.rpc("reserve_str_calculator_lead", {
    p_token: token, p_request_id: requestId,
    p_input_hash: fingerprint(JSON.stringify({ ...fields, country: widget.country })),
    p_client_hash: fingerprint(`${widget.id}:${clientAddress}`),
    p_input: { ...fields, country: widget.country, ...calculatorAssumptions(input.bedrooms) },
    p_consent_version: CALCULATOR_CONSENT_VERSION, p_consent_text: calculatorConsent(brand.name, widget.ask_phone),
  });
  if (error) {
    if (error.code === "PT429") throw new CalculatorError("This calculator has reached its request limit. Please try again later.", 429);
    if (error.code === "PT404") throw new CalculatorError("This calculator is currently unavailable.", 404);
    if (error.code === "PT409") throw new CalculatorError("Your property details changed. Start a new estimate.", 409);
    throw new CalculatorError("We couldn’t save your enquiry. Please try again.", 503);
  }
  const lead = reservation as { id: string; fresh: boolean; status: string; estimate: CalculatorEstimate | null; created_at: string };
  if (!lead.fresh) {
    if (lead.status === "estimated" && lead.estimate) return lead.estimate;
    if (lead.status === "processing" && Date.now() - Date.parse(lead.created_at) < 120_000) {
      throw new CalculatorError("Your estimate is still being prepared. Please try again shortly.", 409, true);
    }
    throw new CalculatorError("Your enquiry has been saved, but we couldn’t prepare an estimate. The agency can follow up with you.", 422, true);
  }

  try {
    // Never spend an estimate credit on development mock coordinates.
    if (!process.env.GOOGLE_MAPS_API_KEY || !process.env.AIRROI_API_KEY) throw new Error("Calculator providers are not configured");
    const location = await geocodeAddress(input.address, widget.country, { requireStreetAddress: true });
    if (location.placeId === "mock-place-id") throw new Error("A real property location is required");
    const assumptions = calculatorAssumptions(input.bedrooms);
    const currency = marketForCountry(widget.country).currency;
    // Only the standard calculator call: no market enrichment, scraping or report generation.
    const { estimate } = await fetchAirroiEstimate({
      latitude: location.latitude, longitude: location.longitude, bedrooms: input.bedrooms,
      bathrooms: input.bathrooms, accommodates: assumptions.guests, radiusM: assumptions.radiusM, currency,
    }, airroiPropertyKey({ ...calculatorLeadAddress(input.address, widget.country), country: widget.country }));
    const result = calculatorEstimateSchema.parse({
      annualRevenue: estimate.annualRevenue, monthlyRevenue: estimate.monthlyRevenue,
      nightlyRate: estimate.nightlyRate, occupancyRate: estimate.occupancyRate,
      currency, address: location.formattedAddress, bedrooms: input.bedrooms,
      bathrooms: input.bathrooms, guests: assumptions.guests,
    });
    const { error: saveError } = await admin.from("str_calculator_leads").update({
      status: "estimated", estimate_json: result, original_estimate_json: estimate.raw,
      completed_at: new Date().toISOString(),
    }).eq("id", lead.id).eq("widget_id", widget.id);
    if (saveError) throw new Error("Could not save estimate");
    return result;
  } catch {
    await admin.from("str_calculator_leads").update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", lead.id).eq("widget_id", widget.id);
    throw new CalculatorError("Your enquiry has been saved, but we couldn’t prepare an estimate for this address. The agency can follow up with you.", 422, true);
  }
}
