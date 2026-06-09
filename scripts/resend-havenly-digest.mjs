/**
 * Resend Havenly digest email for all ledger rows with delivery_reports (no re-scrape).
 *
 * Usage: npx tsx scripts/resend-havenly-digest.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const { getDeliveryTenantBySlug } = await import(
  "../lib/delivery/tenants/repository.ts"
);
const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { sendDeliveryDigestEmail } = await import(
  "../lib/delivery/email/sendDeliveryDigestEmail.ts"
);

const tenant = await getDeliveryTenantBySlug("havenly");
if (!tenant) {
  console.error("Tenant havenly not found");
  process.exit(1);
}

const admin = createAdminClient();
const { data: rows, error } = await admin
  .from("delivery_tenant_properties")
  .select("*")
  .eq("tenant_id", tenant.id)
  .eq("status", "delivered")
  .not("delivery_reports", "is", null)
  .order("delivered_at", { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

const items = (rows ?? [])
  .filter((row) => row.delivery_reports?.str || row.delivery_reports?.lease)
  .map((row) => ({
    deliveryId: row.delivery_id,
    address: row.listing_url,
    listingUrl: row.listing_url,
    listingId: row.listing_id,
    reports: row.delivery_reports,
  }));

if (items.length === 0) {
  console.log("No delivered listings with reports to email.");
  process.exit(0);
}

for (const item of items) {
  const { data: listing } = await admin
    .from("listings")
    .select("property_address, suburb, state")
    .eq("id", item.listingId)
    .maybeSingle();
  if (listing) {
    item.address =
      [listing.property_address, listing.suburb, listing.state]
        .filter(Boolean)
        .join(", ") || item.address;
  }
}

console.log(`Sending digest for ${items.length} listing(s) to`, tenant.email_recipients);
await sendDeliveryDigestEmail({ tenant, items });
console.log("Done.");
