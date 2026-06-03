import { discoverFromPartnerSource } from "@/lib/delivery/scrape/adapters";
import { createScrapeRun, completeScrapeRun } from "@/lib/delivery/scrape-runs/repository";
import { touchTenantLastScrapeAt } from "@/lib/delivery/tenants/repository";
import { processDeliveryListing } from "@/lib/delivery/orchestrator/processListing";
import {
  logDeliveryDigestPreview,
  sendDeliveryDigestEmail,
} from "@/lib/delivery/email/sendDeliveryDigestEmail";
import { maxListingsPerRun, maxListingsPerSource } from "@/lib/delivery/runConfig";
import { emitUsageEvent } from "@/lib/delivery/usage/events";
import { logDelivery, alertDeliveryFailure } from "@/lib/delivery/observability/log";
import type {
  DeliveryProcessedListing,
  DeliveryTenant,
  TenantScrapeRunSummary,
} from "@/lib/delivery/types";

export async function runTenantDelivery(
  tenant: DeliveryTenant,
): Promise<TenantScrapeRunSummary> {
  if (!tenant.enabled || !tenant.scrape_enabled) {
    return {
      runId: "",
      tenantSlug: tenant.slug,
      listingsSeen: 0,
      listingsSkipped: 0,
      listingsProcessed: 0,
      listingsFailed: 0,
      errors: ["Tenant is disabled"],
    };
  }

  const run = await createScrapeRun(tenant.id, tenant.billing_mode);

  logDelivery("info", "tenant scrape run started", {
    tenantSlug: tenant.slug,
    runId: run.id,
    billingMode: tenant.billing_mode,
  });

  const counts = {
    listingsSeen: 0,
    listingsSkipped: 0,
    listingsProcessed: 0,
    listingsFailed: 0,
  };
  const errors: string[] = [];
  const processedListings: DeliveryProcessedListing[] = [];

  const listingUrls: string[] = [];
  const seenUrls = new Set<string>();

  try {
    for (const source of tenant.partner_sources) {
      try {
        const discovered = await discoverFromPartnerSource(source);
        const sourceCap = maxListingsPerSource(source);
        for (const item of discovered.slice(0, sourceCap)) {
          if (seenUrls.has(item.listingUrl)) {
            continue;
          }
          seenUrls.add(item.listingUrl);
          listingUrls.push(item.listingUrl);
        }
      } catch (error) {
        errors.push(
          `Partner source ${source.label ?? source.url}: ${
            error instanceof Error ? error.message : "discovery failed"
          }`,
        );
      }
    }

    const runLimit = maxListingsPerRun(tenant);
    const urls = listingUrls.slice(0, runLimit);
    counts.listingsSeen = urls.length;

    for (const listingUrl of urls) {
      const result = await processDeliveryListing({
        tenant,
        listingUrl,
        scrapeRunId: run.id,
      });

      switch (result.outcome) {
        case "skipped":
          counts.listingsSkipped += 1;
          break;
        case "processed":
          counts.listingsProcessed += 1;
          processedListings.push(result.item);
          break;
        case "failed":
          counts.listingsFailed += 1;
          errors.push(`${listingUrl}: ${result.error}`);
          break;
        default:
          break;
      }
    }

    if (processedListings.length > 0) {
      if (tenant.billing_mode === "production") {
        await sendDeliveryDigestEmail({ tenant, items: processedListings });

        await emitUsageEvent({
          tenantId: tenant.id,
          eventType: "delivery.sent",
          billingMode: tenant.billing_mode,
          scrapeRunId: run.id,
          metadata: {
            digestCount: processedListings.length,
            addresses: processedListings.map((item) => item.address).slice(0, 20),
          },
        });
      } else if (tenant.billing_mode === "shadow") {
        logDeliveryDigestPreview(tenant, processedListings);
      }
    }

    await completeScrapeRun(run.id, counts, "completed");
    await touchTenantLastScrapeAt(tenant.id);

    await emitUsageEvent({
      tenantId: tenant.id,
      eventType: "run.completed",
      billingMode: tenant.billing_mode,
      scrapeRunId: run.id,
      metadata: { ...counts, errors: errors.slice(0, 20) },
    });

    logDelivery("info", "tenant scrape run completed", {
      tenantSlug: tenant.slug,
      runId: run.id,
      ...counts,
    });

    if (errors.length > 0) {
      await alertDeliveryFailure(
        tenant.slug,
        errors.slice(0, 3).join("; "),
        run.id,
      );
    }

    return {
      runId: run.id,
      tenantSlug: tenant.slug,
      ...counts,
      errors,
      processedListings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed";
    errors.push(message);
    await completeScrapeRun(run.id, counts, "failed", message);
    await alertDeliveryFailure(tenant.slug, message, run.id);

    return {
      runId: run.id,
      tenantSlug: tenant.slug,
      ...counts,
      errors,
      processedListings,
    };
  }
}
