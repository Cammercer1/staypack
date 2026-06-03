import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DeliveryReportsJson,
  PropertyLedgerStatus,
  TenantPropertyRecord,
} from "@/lib/delivery/types";

type PropertyRow = TenantPropertyRecord;

function mapRow(row: PropertyRow): TenantPropertyRecord {
  return row;
}

export async function getTenantProperty(
  tenantId: string,
  sourceSite: string,
  sourceListingId: string,
): Promise<TenantPropertyRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("delivery_tenant_properties")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("source_site", sourceSite)
    .eq("source_listing_id", sourceListingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as PropertyRow);
}

export async function upsertTenantPropertySeen({
  tenantId,
  sourceSite,
  sourceListingId,
  listingUrl,
  fingerprint,
  status,
}: {
  tenantId: string;
  sourceSite: string;
  sourceListingId: string;
  listingUrl: string;
  fingerprint: string;
  status?: PropertyLedgerStatus;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("delivery_tenant_properties")
    .upsert(
      {
        tenant_id: tenantId,
        source_site: sourceSite,
        source_listing_id: sourceListingId,
        listing_url: listingUrl,
        content_fingerprint: fingerprint,
        status: status ?? "discovered",
        last_seen_at: now,
      },
      { onConflict: "tenant_id,source_site,source_listing_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as PropertyRow);
}

export async function markPropertyProcessing(
  id: string,
  fingerprint: string,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("delivery_tenant_properties")
    .update({
      status: "processing",
      content_fingerprint: fingerprint,
      last_seen_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markPropertyDelivered({
  id,
  deliveryId,
  reportId,
  listingId,
  deliveryReports,
}: {
  id: string;
  deliveryId: string;
  reportId: string;
  listingId: string;
  deliveryReports?: DeliveryReportsJson;
}) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("delivery_tenant_properties")
    .update({
      status: "delivered",
      delivery_id: deliveryId,
      report_id: reportId,
      listing_id: listingId,
      delivery_reports: deliveryReports ?? null,
      delivered_at: now,
      last_seen_at: now,
      last_error: null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markPropertyFailed(id: string, message: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("delivery_tenant_properties")
    .select("retry_count")
    .eq("id", id)
    .single();

  const retryCount = (existing?.retry_count ?? 0) + 1;

  const { error } = await admin
    .from("delivery_tenant_properties")
    .update({
      status: "failed",
      last_error: message.slice(0, 2000),
      retry_count: retryCount,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function touchPropertyLastSeen(id: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("delivery_tenant_properties")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
