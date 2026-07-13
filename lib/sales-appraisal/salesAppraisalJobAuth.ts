import { createHmac, timingSafeEqual } from "node:crypto";

export const SALES_APPRAISAL_JOB_TS_HEADER = "x-staypack-sales-job-ts";
export const SALES_APPRAISAL_JOB_SIGNATURE_HEADER =
  "x-staypack-sales-job-signature";

const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;

function getSalesAppraisalJobSecret() {
  const secret =
    process.env.SALES_APPRAISAL_JOB_SECRET?.trim() ||
    process.env.LEASE_APPRAISAL_JOB_SECRET?.trim() ||
    process.env.DELIVERY_CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new Error("Sales appraisal job secret is not configured");
  }

  return secret;
}

function signatureFor(timestamp: string, body: string) {
  return createHmac("sha256", getSalesAppraisalJobSecret())
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export function signSalesAppraisalJobBody(body: string) {
  const timestamp = String(Date.now());
  return {
    timestamp,
    signature: signatureFor(timestamp, body),
  };
}

export function assertSalesAppraisalJobSignature({
  body,
  timestamp,
  signature,
}: {
  body: string;
  timestamp: string | null;
  signature: string | null;
}) {
  if (!timestamp || !signature) {
    throw new Error("Unauthorized");
  }

  const timestampMs = Number(timestamp);
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > MAX_SIGNATURE_AGE_MS
  ) {
    throw new Error("Unauthorized");
  }

  const expected = signatureFor(timestamp, body);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Unauthorized");
  }
}
