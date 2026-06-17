import type { LeaseAppraisalEnrichmentStatus, ParsedListing } from "@/lib/types";

const ACTIVE_ENRICHMENT_MAX_AGE_MS = 5 * 60 * 1000;

export function leaseAppraisalEnrichmentStatus(
  parsed: ParsedListing | null | undefined,
) {
  return parsed?.leaseAppraisalEnrichment ?? null;
}

export function isLeaseAppraisalEnrichmentActive(
  status: LeaseAppraisalEnrichmentStatus | null | undefined,
  now = Date.now(),
) {
  if (status?.status !== "processing") {
    return false;
  }

  const startedAt = status.startedAt ? Date.parse(status.startedAt) : NaN;
  if (!Number.isFinite(startedAt)) {
    return true;
  }

  return now - startedAt < ACTIVE_ENRICHMENT_MAX_AGE_MS;
}

export function withLeaseAppraisalEnrichmentStatus(
  parsed: ParsedListing,
  status: LeaseAppraisalEnrichmentStatus,
): ParsedListing {
  return {
    ...parsed,
    leaseAppraisalEnrichment: status,
  };
}

export function processingLeaseAppraisalEnrichmentStatus(
  requestId: string,
  nowIso = new Date().toISOString(),
): LeaseAppraisalEnrichmentStatus {
  return {
    status: "processing",
    requestId,
    startedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function completedLeaseAppraisalEnrichmentStatus(
  previous: LeaseAppraisalEnrichmentStatus | null | undefined,
  requestId: string,
  nowIso = new Date().toISOString(),
): LeaseAppraisalEnrichmentStatus {
  return {
    status: "completed",
    requestId,
    startedAt: previous?.requestId === requestId ? previous.startedAt : undefined,
    completedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function failedLeaseAppraisalEnrichmentStatus(
  previous: LeaseAppraisalEnrichmentStatus | null | undefined,
  requestId: string,
  error: string,
  nowIso = new Date().toISOString(),
): LeaseAppraisalEnrichmentStatus {
  return {
    status: "failed",
    requestId,
    startedAt: previous?.requestId === requestId ? previous.startedAt : undefined,
    failedAt: nowIso,
    updatedAt: nowIso,
    error,
  };
}
