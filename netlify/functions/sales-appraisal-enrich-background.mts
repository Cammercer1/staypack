import { createAdminClient } from "../../lib/supabase/admin";
import {
  assertSalesAppraisalJobSignature,
  SALES_APPRAISAL_JOB_SIGNATURE_HEADER,
  SALES_APPRAISAL_JOB_TS_HEADER,
} from "../../lib/sales-appraisal/salesAppraisalJobAuth";
import { runSalesAppraisalJob } from "../../lib/sales-appraisal/runSalesAppraisalJob";

type Payload = {
  jobId?: string;
};

export default async function handler(request: Request) {
  const body = await request.text();
  assertSalesAppraisalJobSignature({
    body,
    timestamp: request.headers.get(SALES_APPRAISAL_JOB_TS_HEADER),
    signature: request.headers.get(SALES_APPRAISAL_JOB_SIGNATURE_HEADER),
  });

  const payload = JSON.parse(body) as Payload;
  if (!payload.jobId) {
    throw new Error("Missing sales appraisal job id");
  }

  await runSalesAppraisalJob({
    supabase: createAdminClient(),
    jobId: payload.jobId,
  });

  return new Response(null, { status: 204 });
}

export const config = {
  background: true,
  path: "/background/sales-appraisal-enrich",
};
