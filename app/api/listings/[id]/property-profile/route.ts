import { assertPropertyCountry } from "@/lib/property-market/agencyCountry";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { hasFreshPropertyProfile, refreshPropertyProfile } from "@/lib/domain-avm/refreshPropertyProfile";
import { userFacingPropertyMessage } from "@/lib/listings/userFacingPropertyMessages";
import { propertyCandidateSchema } from "@/lib/listings/propertyLookupTypes";
import { calculatorLeadPropertyEvidence, lookupCalculatorLeadProperty } from "@/lib/str-calculator/leadProperty";
import { calculatorPropertyReviewKey } from "@/lib/str-calculator/propertyReviewIdentity";
import { automaticCalculatorAddress, loadCanonicalCalculatorLead } from "@/lib/str-calculator/leadCanonicalProperty";
import type { Listing, Report } from "@/lib/types";

export const maxDuration = 60;
const addressSchema = z.object({
  property_address: z.string().trim().min(1).max(250),
  suburb: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(20),
  postcode: z.string().trim().min(1).max(10),
});
const inputSchema = z.object({
  refresh: z.boolean().default(false),
  calculatorReview: z.boolean().default(false),
  reportId: z.uuid().optional(),
  candidate: propertyCandidateSchema.optional(),
  address: addressSchema.optional(),
}).refine(input => !(input.candidate && input.address), "Choose a property result or enter an address, not both.")
  .refine(input => input.calculatorReview || !(input.candidate || input.address), "Review the calculator property before changing its address.");
const headers = { "Cache-Control": "private, no-store" };

function lookupFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Property details are unavailable. You can enter them manually.";
  if (/429|quota/i.test(message)) return "Property lookup is temporarily unavailable. Use the saved details or enter the figures and amenities manually.";
  if (/Domain AVM request failed/i.test(message)) return "Property lookup is temporarily unavailable. You can enter the figures and amenities manually.";
  return userFacingPropertyMessage(message);
}

/** A corrected home must not inherit coordinates, photos or valuations from the
 * original enquiry. Published reports keep their separate final-report snapshot. */
function clearedPropertyEvidence(): Partial<Listing> {
  return {
    latitude: null, longitude: null, scraped_listing_json: null,
    hero_image_url: null, selected_image_urls: [], uploaded_image_urls: [],
    listing_image_meta: {}, collateral_image_selections: {},
    listing_url: null, property_type: null, car_spaces: null,
    listing_title: null, listing_description: null, display_price: null,
    advertised_sale_price: null, advertised_weekly_rent: null, bond: null,
    appraisal_overrides_json: {},
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, listing, agency } = await requireListingAccess(id);
    const country = assertPropertyCountry(agency, listing);
    const input = inputSchema.parse(await request.json());
    if (listing.status === "archived") return NextResponse.json({ error: "Restore this property before refreshing it." }, { status: 409, headers });
    let patch: Partial<Listing>;
    let cached = false;
    let profileWarning: string | undefined;
    let identityChanged = false;
    let automaticCorrection = false;
    if (input.calculatorReview) {
      if (input.candidate) {
        assertPropertyCountry(agency, { ...input.candidate, country: input.candidate.country ?? country });
        if (input.candidate.partialMatch || (country === "AU" && input.candidate.source === "zillow")
          || (country === "US" && input.candidate.source === "domain")) {
          return NextResponse.json({ error: "Choose a complete property address in your agency's country." }, { status: 400, headers });
        }
      }
      let address = input.candidate ? addressSchema.parse({ property_address: input.candidate.streetAddress,
        suburb: input.candidate.suburb, state: input.candidate.state, postcode: input.candidate.postcode }) : input.address;
      if (!address && input.reportId) {
        const { data: report, error } = await supabase.from("reports")
          .select("id,status,published_at,final_report_json,user_overrides_json")
          .eq("id", input.reportId).eq("listing_id", listing.id).eq("agency_id", listing.agency_id).maybeSingle();
        if (error || !report) throw new Error("Calculator appraisal not found for this property.");
        const lead = await loadCanonicalCalculatorLead(listing.agency_id, input.reportId);
        const canonical = lead && automaticCalculatorAddress(lead, listing, report as Report);
        if (canonical) { address = addressSchema.parse(canonical); automaticCorrection = true; }
      }
      const expected = { ...listing, ...address };
      assertPropertyCountry(agency, expected);
      identityChanged = Boolean(address && calculatorPropertyReviewKey(listing) !== calculatorPropertyReviewKey(expected));
      // Google's saved locality describes the same unit and coordinates. Keep
      // user photos/overrides; only manual changes can select a different home.
      patch = { ...address, ...(identityChanged && !automaticCorrection ? clearedPropertyEvidence() : {}) };
      const reviewed = { ...expected, ...patch };
      try {
        cached = !identityChanged && !input.refresh && !input.candidate && hasFreshPropertyProfile(listing);
        const evidence = cached ? calculatorLeadPropertyEvidence(listing)
          : await lookupCalculatorLeadProperty(reviewed, country, input.candidate);
        patch = { ...patch, ...evidence };
        if (!identityChanged || automaticCorrection) {
          // Keep photos already chosen or uploaded during an earlier review.
          if (listing.hero_image_url) patch.hero_image_url = listing.hero_image_url;
          if (listing.selected_image_urls?.length) patch.selected_image_urls = listing.selected_image_urls;
          patch.listing_image_meta = { ...evidence.listing_image_meta, ...listing.listing_image_meta };
        }
      } catch (error) {
        unstable_rethrow(error);
        if (!address) throw error;
        // A valid user correction can still be saved when provider coverage is
        // missing, so manual entry never requires keeping the wrong address.
        profileWarning = lookupFailureMessage(error);
      }
    } else {
      if (!input.refresh && hasFreshPropertyProfile(listing)) return NextResponse.json({ listing, cached: true }, { headers });
      patch = { scraped_listing_json: await refreshPropertyProfile(listing) };
    }
    const { data, error } = await supabase.from("listings")
      .update(patch)
      .eq("id", listing.id).eq("agency_id", listing.agency_id).eq("updated_at", listing.updated_at)
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "The property changed while details were loading. Refresh the page to use the latest details." }, { status: 409, headers });
    return NextResponse.json({ listing: data, cached, ...(input.calculatorReview ? {
      identity_changed: identityChanged && !automaticCorrection, address_corrected: identityChanged && automaticCorrection,
    } : {}),
      ...(profileWarning ? { profile_warning: profileWarning } : {}) }, { headers });
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "";
    const status = /429|quota/i.test(message) ? 429 : /Domain AVM request failed/i.test(message) ? 502 : 400;
    return NextResponse.json({ error: lookupFailureMessage(error) }, { status, headers });
  }
}
