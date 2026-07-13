import type { LeaseAppraisalEnrichmentStatus, ParsedListing } from "@/lib/types";

const ACTIVE_ENRICHMENT_MAX_AGE_MS = 5 * 60 * 1000;

export type SalesAppraisalEnrichmentStatus = LeaseAppraisalEnrichmentStatus;

export function salesAppraisalEnrichmentStatus(
  parsed: ParsedListing | null | undefined,
) {
  return parsed?.salesAppraisalEnrichment ?? null;
}

export function isSalesAppraisalEnrichmentActive(
  status: SalesAppraisalEnrichmentStatus | null | undefined,
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

export function withSalesAppraisalEnrichmentStatus(
  parsed: ParsedListing,
  status: SalesAppraisalEnrichmentStatus,
): ParsedListing {
  return {
    ...parsed,
    salesAppraisalEnrichment: status,
  };
}

export function processingSalesAppraisalEnrichmentStatus(
  requestId: string,
  nowIso = new Date().toISOString(),
): SalesAppraisalEnrichmentStatus {
  return {
    status: "processing",
    requestId,
    startedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function completedSalesAppraisalEnrichmentStatus(
  previous: SalesAppraisalEnrichmentStatus | null | undefined,
  requestId: string,
  nowIso = new Date().toISOString(),
): SalesAppraisalEnrichmentStatus {
  return {
    status: "completed",
    requestId,
    startedAt: previous?.requestId === requestId ? previous.startedAt : undefined,
    completedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function failedSalesAppraisalEnrichmentStatus(
  previous: SalesAppraisalEnrichmentStatus | null | undefined,
  requestId: string,
  error: string,
  nowIso = new Date().toISOString(),
): SalesAppraisalEnrichmentStatus {
  return {
    status: "failed",
    requestId,
    startedAt: previous?.requestId === requestId ? previous.startedAt : undefined,
    failedAt: nowIso,
    updatedAt: nowIso,
    error,
  };
}
