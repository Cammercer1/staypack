import { createAdminClient } from "../../lib/supabase/admin";
import {
  assertLeaseAppraisalJobSignature,
  LEASE_APPRAISAL_JOB_SIGNATURE_HEADER,
  LEASE_APPRAISAL_JOB_TS_HEADER,
} from "../../lib/lease-appraisal/leaseAppraisalJobAuth";
import { runLeaseAppraisalJob } from "../../lib/lease-appraisal/runLeaseAppraisalJob";

type Payload = {
  jobId?: string;
};

export default async function handler(request: Request) {
  const body = await request.text();
  assertLeaseAppraisalJobSignature({
    body,
    timestamp: request.headers.get(LEASE_APPRAISAL_JOB_TS_HEADER),
    signature: request.headers.get(LEASE_APPRAISAL_JOB_SIGNATURE_HEADER),
  });

  const payload = JSON.parse(body) as Payload;
  if (!payload.jobId) {
    throw new Error("Missing lease appraisal job id");
  }

  await runLeaseAppraisalJob({
    supabase: createAdminClient(),
    jobId: payload.jobId,
  });

  return new Response(null, { status: 204 });
}

export const config = {
  background: true,
  path: "/background/lease-appraisal-enrich",
};
