import "server-only";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatorLeadAddress, canonicalCalculatorLeadAddress } from "./leadAddress";
import { calculatorPropertyReviewKey } from "./propertyReviewIdentity";
import type { Listing, Report } from "@/lib/types";

export type CanonicalCalculatorLead = {
  address: string; country: "AU" | "US"; status: string;
  estimate_json: unknown; original_estimate_json: unknown; completed_at: string | null;
};

/** Call only after authorising report/listing access. Provider payloads are
 * deliberately private, so read them server-side with explicit ownership scope. */
export async function loadCanonicalCalculatorLead(agencyId: string, reportId: string, admin: SupabaseClient = createAdminClient()) {
  const { data, error } = await admin.from("str_calculator_leads")
    .select("address,country,status,estimate_json,original_estimate_json,completed_at")
    .eq("report_id", reportId).eq("agency_id", agencyId).maybeSingle();
  if (error) throw new Error("Couldn’t check this enquiry’s saved address. Please try again.");
  return data as CanonicalCalculatorLead | null;
}

function canonicalProperty(lead: CanonicalCalculatorLead) {
  const result = z.object({ address: z.string() }).safeParse(lead.estimate_json);
  return lead.status === "estimated" && result.success
    ? canonicalCalculatorLeadAddress(lead.address, lead.country, result.data.address) : null;
}

/** Only correct the untouched enquiry address. Explicit edits and previously
 * verified/published reports must never be reset by an automatic profile lookup. */
export function automaticCalculatorAddress(lead: CanonicalCalculatorLead, listing: Listing, report: Report) {
  if (report.status === "published" || report.status === "archived" || report.published_at || report.final_report_json
    || report.user_overrides_json?.calculatorReview?.status === "verified"
    || report.user_overrides_json?.strProperty) return null;
  const submitted = { ...calculatorLeadAddress(lead.address, lead.country), country: lead.country };
  if (calculatorPropertyReviewKey(listing) !== calculatorPropertyReviewKey(submitted)) return null;
  return canonicalProperty(lead);
}

const evidenceSchema = z.object({ provider: z.literal("airroi"), input: z.record(z.string(), z.unknown()), response: z.record(z.string(), z.unknown()), fetched_at: z.string().optional() });

/** A locality alias may identify only the original lead evidence. Matching
 * coordinates alone cannot certify a later estimate for another apartment. */
export function canonicalCalculatorSourceKey(lead: CanonicalCalculatorLead, report: Report) {
  const property = canonicalProperty(lead);
  const original = evidenceSchema.safeParse(lead.original_estimate_json);
  const saved = evidenceSchema.safeParse(report.original_estimate_json?.raw);
  if (!property || !original.success || !saved.success
    || !isDeepStrictEqual(original.data.input, saved.data.input)
    || !isDeepStrictEqual(original.data.response, saved.data.response)
    || (original.data.fetched_at ?? lead.completed_at) !== saved.data.fetched_at) return null;
  return calculatorPropertyReviewKey({ ...property, country: lead.country });
}
