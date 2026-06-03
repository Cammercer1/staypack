import type { DeliveryTenantBrand } from "@/lib/delivery/brand/schema";
import type { ParsedListing } from "@/lib/types";

export type DeliveryBillingMode = "production" | "shadow" | "dry_run";

export type DeliveryDeliverable = "str" | "lease_appraisal";

export type ScrapeSchedule =
  | { type: "interval"; intervalHours: number }
  | { type: "cron"; cron: string };

export type PartnerSource = {
  label?: string;
  url: string;
  adapter?: string;
  config?: Record<string, unknown>;
};

export type TenantBillingConfig = {
  billingPlan?: string;
  includedDeliveriesPerMonth?: number;
  overagePricePerDeliveryCents?: number;
  billingEmail?: string;
  stripeCustomerId?: string;
};

export type DeliveryTenant = {
  id: string;
  slug: string;
  name: string;
  agency_id: string | null;
  brand: DeliveryTenantBrand;
  enabled: boolean;
  timezone: string;
  scrape_enabled: boolean;
  scrape_schedule: ScrapeSchedule;
  last_scrape_at: string | null;
  partner_sources: PartnerSource[];
  email_recipients: string[];
  email_from: string | null;
  email_subject_template: string | null;
  str_template_pack_id: string | null;
  deliverables: DeliveryDeliverable[];
  billing_mode: DeliveryBillingMode;
  billing: TenantBillingConfig;
  feature_flags: Record<string, unknown>;
  reprocess_on_material_change: boolean;
};

export type PropertyLedgerStatus =
  | "discovered"
  | "processing"
  | "delivered"
  | "failed"
  | "skipped";

export type TenantPropertyRecord = {
  id: string;
  tenant_id: string;
  source_site: string;
  source_listing_id: string;
  listing_url: string | null;
  status: PropertyLedgerStatus;
  content_fingerprint: string;
  first_seen_at: string;
  last_seen_at: string;
  delivered_at: string | null;
  delivery_id: string | null;
  report_id: string | null;
  listing_id: string | null;
  delivery_reports: DeliveryReportsJson | null;
  last_error: string | null;
  retry_count: number;
};

export type ScrapeRunRecord = {
  id: string;
  tenant_id: string;
  status: "running" | "completed" | "failed";
  billing_mode: DeliveryBillingMode;
  started_at: string;
  completed_at: string | null;
  listings_seen: number;
  listings_skipped: number;
  listings_processed: number;
  listings_failed: number;
  error_message: string | null;
};

export type NormalizedScrapedListing = {
  listingUrl: string;
  sourceSite: string;
  sourceListingId: string;
  parsed: ParsedListing;
};

export type LedgerGateResult =
  | { action: "process"; record: TenantPropertyRecord | null }
  | { action: "skip"; reason: string; record: TenantPropertyRecord }
  | { action: "retry"; record: TenantPropertyRecord };

export type DeliveryReportArtifact = {
  reportId: string;
  publicUrl: string;
  pdfUrl: string;
  pdfFilename: string;
};

export type DeliveryReportsJson = {
  str?: DeliveryReportArtifact;
  lease?: DeliveryReportArtifact;
};

export type DeliveryProcessedListing = {
  deliveryId: string;
  address: string;
  listingUrl: string;
  listingId: string;
  reports: DeliveryReportsJson;
};

export type TenantScrapeRunSummary = {
  runId: string;
  tenantSlug: string;
  listingsSeen: number;
  listingsSkipped: number;
  listingsProcessed: number;
  listingsFailed: number;
  errors: string[];
  processedListings?: DeliveryProcessedListing[];
};
