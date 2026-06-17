import type { LeaseAppraisalJob, LeaseAppraisalJobStatus } from "@/lib/types";

export const LEASE_APPRAISAL_JOB_ACTIVE_MS = 10 * 60 * 1000;
export const LEASE_APPRAISAL_JOB_PENDING_MS = 90 * 1000;

export function isLeaseAppraisalJobActive(
  job: Pick<
    LeaseAppraisalJob,
    "status" | "started_at" | "heartbeat_at" | "created_at"
  > | null | undefined,
  now = Date.now(),
) {
  if (!job || !["pending", "processing"].includes(job.status)) {
    return false;
  }

  const timestamp =
    job.status === "pending"
      ? job.created_at ?? undefined
      : job.heartbeat_at ?? job.started_at ?? job.created_at ?? undefined;
  const started = timestamp ? Date.parse(timestamp) : NaN;

  if (!Number.isFinite(started)) {
    return true;
  }

  const timeoutMs =
    job.status === "pending"
      ? LEASE_APPRAISAL_JOB_PENDING_MS
      : LEASE_APPRAISAL_JOB_ACTIVE_MS;

  return now - started < timeoutMs;
}

export function leaseAppraisalJobTimeoutMessage(
  job: Pick<LeaseAppraisalJob, "status">,
) {
  return job.status === "pending"
    ? "Rental comps did not start in time. Refresh comps to try again."
    : "Rental comps did not finish in time. Refresh comps to try again.";
}

export function leaseAppraisalJobsTableMissing(error: unknown) {
  const maybe = error as { code?: string; message?: string } | null | undefined;
  return (
    maybe?.code === "42P01" ||
    maybe?.message?.toLowerCase().includes("lease_appraisal_jobs") === true
  );
}

export function normalizeLeaseAppraisalJobStatus(
  status: string | null | undefined,
): LeaseAppraisalJobStatus {
  if (
    status === "pending" ||
    status === "processing" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return "pending";
}
