import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryBillingMode, ScrapeRunRecord } from "@/lib/delivery/types";

export async function createScrapeRun(
  tenantId: string,
  billingMode: DeliveryBillingMode,
): Promise<ScrapeRunRecord> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("delivery_scrape_runs")
    .insert({
      tenant_id: tenantId,
      status: "running",
      billing_mode: billingMode,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ScrapeRunRecord;
}

export async function completeScrapeRun(
  runId: string,
  counts: {
    listingsSeen: number;
    listingsSkipped: number;
    listingsProcessed: number;
    listingsFailed: number;
  },
  status: "completed" | "failed",
  errorMessage?: string,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("delivery_scrape_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      listings_seen: counts.listingsSeen,
      listings_skipped: counts.listingsSkipped,
      listings_processed: counts.listingsProcessed,
      listings_failed: counts.listingsFailed,
      error_message: errorMessage ?? null,
    })
    .eq("id", runId);

  if (error) throw new Error(error.message);
}
