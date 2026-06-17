import type { LeaseAppraisalJob, LeaseAppraisalJobStatus } from "@/lib/types";

export const LEASE_APPRAISAL_JOB_ACTIVE_MS = 10 * 60 * 1000;

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
    job.heartbeat_at ?? job.started_at ?? job.created_at ?? undefined;
  const started = timestamp ? Date.parse(timestamp) : NaN;

  if (!Number.isFinite(started)) {
    return true;
  }

  return now - started < LEASE_APPRAISAL_JOB_ACTIVE_MS;
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
