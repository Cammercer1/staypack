import { createAdminClient } from "../../lib/supabase/admin";
import {
  assertLeaseAppraisalEnrichSignature,
  LEASE_APPRAISAL_ENRICH_SIGNATURE_HEADER,
  LEASE_APPRAISAL_ENRICH_TS_HEADER,
} from "../../lib/lease-appraisal/enrichmentJobAuth";
import {
  failedLeaseAppraisalEnrichmentStatus,
  leaseAppraisalEnrichmentStatus,
  withLeaseAppraisalEnrichmentStatus,
} from "../../lib/lease-appraisal/enrichmentStatus";
import { runLeaseAppraisalEnrichmentJob } from "../../lib/lease-appraisal/runLeaseAppraisalEnrichmentJob";
import type { ParsedListing } from "../../lib/types";

type Payload = {
  listingId?: string;
  agencyId?: string;
  requestId?: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to fetch rental comps";
}

function hasCompletePayload(
  payload: Payload | null,
): payload is Required<Payload> {
  return Boolean(payload?.listingId && payload.agencyId && payload.requestId);
}

async function markFailedForPayload(
  payload: Required<Payload>,
  message: string,
) {
  try {
    const supabase = createAdminClient();
    const { data: listing, error } = await supabase
      .from("listings")
      .select("scraped_listing_json")
      .eq("id", payload.listingId)
      .eq("agency_id", payload.agencyId)
      .maybeSingle();

    if (error || !listing?.scraped_listing_json) {
      return;
    }

    const parsed = listing.scraped_listing_json as ParsedListing;
    const status = leaseAppraisalEnrichmentStatus(parsed);
    if (status?.requestId !== payload.requestId) {
      return;
    }

    await supabase
      .from("listings")
      .update({
        scraped_listing_json: withLeaseAppraisalEnrichmentStatus(
          parsed,
          failedLeaseAppraisalEnrichmentStatus(
            status,
            payload.requestId,
            message,
          ),
        ),
      })
      .eq("id", payload.listingId)
      .eq("agency_id", payload.agencyId);
  } catch (saveError) {
    console.error(
      "Failed to save lease appraisal background failure status:",
      saveError,
    );
  }
}

export default async function handler(request: Request) {
  let payload: Payload | null = null;
  let authorized = false;

  try {
    const body = await request.text();
    payload = JSON.parse(body) as Payload;
    assertLeaseAppraisalEnrichSignature({
      body,
      timestamp: request.headers.get(LEASE_APPRAISAL_ENRICH_TS_HEADER),
      signature: request.headers.get(LEASE_APPRAISAL_ENRICH_SIGNATURE_HEADER),
    });
    authorized = true;

    if (!hasCompletePayload(payload)) {
      throw new Error("Missing lease appraisal enrichment payload");
    }

    await runLeaseAppraisalEnrichmentJob({
      supabase: createAdminClient(),
      listingId: payload.listingId,
      agencyId: payload.agencyId,
      requestId: payload.requestId,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    const message = errorMessage(error);
    console.error("Lease appraisal background enrichment failed:", message);

    if (authorized && hasCompletePayload(payload)) {
      await markFailedForPayload(payload, message);
    }

    throw error;
  }
}

export const config = {
  background: true,
  path: "/background/lease-appraisal-enrich",
};
