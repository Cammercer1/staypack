import { createAdminClient } from "../../lib/supabase/admin";
import {
  assertLeaseAppraisalEnrichSignature,
  LEASE_APPRAISAL_ENRICH_SIGNATURE_HEADER,
  LEASE_APPRAISAL_ENRICH_TS_HEADER,
} from "../../lib/lease-appraisal/enrichmentJobAuth";
import { runLeaseAppraisalEnrichmentJob } from "../../lib/lease-appraisal/runLeaseAppraisalEnrichmentJob";

type Payload = {
  listingId?: string;
  agencyId?: string;
  requestId?: string;
};

export default async function handler(request: Request) {
  const body = await request.text();
  assertLeaseAppraisalEnrichSignature({
    body,
    timestamp: request.headers.get(LEASE_APPRAISAL_ENRICH_TS_HEADER),
    signature: request.headers.get(LEASE_APPRAISAL_ENRICH_SIGNATURE_HEADER),
  });

  const payload = JSON.parse(body) as Payload;
  if (!payload.listingId || !payload.agencyId || !payload.requestId) {
    throw new Error("Missing lease appraisal enrichment payload");
  }

  await runLeaseAppraisalEnrichmentJob({
    supabase: createAdminClient(),
    listingId: payload.listingId,
    agencyId: payload.agencyId,
    requestId: payload.requestId,
  });

  return new Response(null, { status: 204 });
}

export const config = {
  background: true,
  path: "/background/lease-appraisal-enrich",
};
