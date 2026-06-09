import type { DeliveryTenant, PartnerSource } from "@/lib/delivery/types";

const ABSOLUTE_MAX_LISTINGS_PER_RUN = 25;
const ABSOLUTE_MAX_LISTINGS_PER_SOURCE = 20;
const DEFAULT_MAX_LISTINGS_PER_SOURCE = 5;
/** How many URLs to scan per partner index when picking undelivered listings. */
export const DISCOVERY_CANDIDATES_PER_SOURCE = 30;

/** Per-tenant cap on listings processed per cron/run invocation. */
export function maxListingsPerRun(tenant: DeliveryTenant): number {
  const configured = tenant.feature_flags?.max_listings_per_run;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.floor(configured), ABSOLUTE_MAX_LISTINGS_PER_RUN);
  }

  const hasStr = tenant.deliverables.includes("str");
  const hasLease = tenant.deliverables.includes("lease_appraisal");
  if (hasStr && hasLease) {
    return 1;
  }
  if (hasLease) {
    return 2;
  }

  return 5;
}

/** Max listing URLs taken from each partner index per run (`partner_sources[].config.max_listings`). */
export function maxListingsPerSource(source: PartnerSource): number {
  const configured = source.config?.max_listings ?? source.config?.maxListings;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.floor(configured), ABSOLUTE_MAX_LISTINGS_PER_SOURCE);
  }
  return DEFAULT_MAX_LISTINGS_PER_SOURCE;
}
