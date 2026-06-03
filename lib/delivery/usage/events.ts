import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryBillingMode } from "@/lib/delivery/types";

export type UsageEventType =
  | "str_report.generated"
  | "lease_report.generated"
  | "delivery.sent"
  | "delivery.failed"
  | "listing.discovered"
  | "listing.skipped"
  | "run.completed";

export async function emitUsageEvent({
  tenantId,
  eventType,
  billingMode,
  sourceListingId,
  deliveryId,
  scrapeRunId,
  metadata,
  quantity = 1,
}: {
  tenantId: string;
  eventType: UsageEventType;
  billingMode: DeliveryBillingMode;
  sourceListingId?: string;
  deliveryId?: string;
  scrapeRunId?: string;
  metadata?: Record<string, unknown>;
  quantity?: number;
}) {
  const admin = createAdminClient();

  const row = {
    tenant_id: tenantId,
    event_type: eventType,
    quantity,
    billing_mode: billingMode,
    source_listing_id: sourceListingId ?? null,
    delivery_id: deliveryId ?? null,
    scrape_run_id: scrapeRunId ?? null,
    metadata: metadata ?? {},
    occurred_at: new Date().toISOString(),
  };

  const { error } = await admin.from("delivery_usage_events").insert(row);

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export type MonthlyRollup = {
  tenantId: string;
  period: string;
  deliveriesSent: number;
  strReportsGenerated: number;
  listingsDiscovered: number;
  listingsSkipped: number;
  failedDeliveries: number;
};

export async function rollupTenantUsage(
  tenantId: string,
  period: string,
): Promise<MonthlyRollup> {
  const admin = createAdminClient();
  const [year, month] = period.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const { data, error } = await admin
    .from("delivery_usage_events")
    .select("event_type, quantity")
    .eq("tenant_id", tenantId)
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString());

  if (error) throw new Error(error.message);

  const rollup: MonthlyRollup = {
    tenantId,
    period,
    deliveriesSent: 0,
    strReportsGenerated: 0,
    listingsDiscovered: 0,
    listingsSkipped: 0,
    failedDeliveries: 0,
  };

  for (const row of data ?? []) {
    const qty = row.quantity ?? 1;
    switch (row.event_type) {
      case "delivery.sent":
        rollup.deliveriesSent += qty;
        break;
      case "str_report.generated":
        rollup.strReportsGenerated += qty;
        break;
      case "listing.discovered":
        rollup.listingsDiscovered += qty;
        break;
      case "listing.skipped":
        rollup.listingsSkipped += qty;
        break;
      case "delivery.failed":
        rollup.failedDeliveries += qty;
        break;
      default:
        break;
    }
  }

  return rollup;
}
