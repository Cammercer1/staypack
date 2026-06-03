#!/usr/bin/env node
/**
 * Export monthly delivery usage for invoicing.
 * Usage: node scripts/export-tenant-usage.mjs <tenantSlug> [YYYY-MM]
 */

const slug = process.argv[2];
const period = process.argv[3] ?? new Date().toISOString().slice(0, 7);
const baseUrl = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.DELIVERY_CRON_SECRET;

if (!slug) {
  console.error("Usage: node scripts/export-tenant-usage.mjs <tenantSlug> [YYYY-MM]");
  process.exit(1);
}

if (!secret) {
  console.error("DELIVERY_CRON_SECRET is required");
  process.exit(1);
}

const url = `${baseUrl}/api/delivery/usage/${encodeURIComponent(slug)}?period=${period}`;

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await response.json();

if (!response.ok) {
  console.error(body.error ?? "Request failed");
  process.exit(1);
}

console.log(
  [
    "tenant_period",
    "deliveries_sent",
    "str_generated",
    "discovered",
    "skipped",
    "failed",
    "included",
    "overage",
    "estimated_overage_cents",
  ].join(","),
);

console.log(
  [
    `${slug}_${period}`,
    body.rollup.deliveriesSent,
    body.rollup.strReportsGenerated,
    body.rollup.listingsDiscovered,
    body.rollup.listingsSkipped,
    body.rollup.failedDeliveries,
    body.billing.includedDeliveriesPerMonth,
    body.billing.overageDeliveries,
    body.billing.estimatedOverageCents,
  ].join(","),
);
