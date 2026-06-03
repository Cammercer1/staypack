/**
 * Haven / SPFN end-to-end: discover → REA → STR PDF → email.
 *
 * Usage:
 *   npx tsx scripts/run-haven-delivery-e2e.mjs you@example.com
 *   DELIVERY_TEST_EMAIL=you@example.com npx tsx scripts/run-haven-delivery-e2e.mjs
 *   npx tsx scripts/run-haven-delivery-e2e.mjs --pdf-only   # shadow, no email
 *   npx tsx scripts/run-haven-delivery-e2e.mjs --force …    # re-run same listing (clears ledger row)
 *
 * Default: first SPFN listing not already delivered (see delivery_tenant_properties).
 *
 * Requires .env.local: Supabase, AIRBTICS, BRIGHTDATA (+ unlocker), OPENAI,
 * optional RESEND_API_KEY for real email (otherwise dev log only).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TENANT_SLUG = "havenly-e2e";
const SEARCH_URL =
  "https://surfersparadisefn.com.au/real-estate-search/residential-real-estate?ltype=1&page=1&sort=date-desc";

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

const pdfOnly = process.argv.includes("--pdf-only");
const forceRetest = process.argv.includes("--force");
const testEmail =
  process.argv.find((a) => a.includes("@"))?.trim() ||
  process.env.DELIVERY_TEST_EMAIL?.trim() ||
  "";

if (!pdfOnly && (!testEmail || !testEmail.includes("@"))) {
  console.error(
    "Pass your email: npx tsx scripts/run-haven-delivery-e2e.mjs you@example.com",
  );
  console.error("Or set DELIVERY_TEST_EMAIL in .env.local");
  console.error("Or use --pdf-only to skip email (shadow mode, saves PDF locally)");
  process.exit(1);
}

const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
const billingMode =
  pdfOnly || !hasResend ? "shadow" : "production";

const { discoverFromPartnerSource } = await import(
  "../lib/delivery/scrape/adapters/index.ts"
);
const { upsertDeliveryTenant } = await import(
  "../lib/delivery/tenants/repository.ts"
);
const { createScrapeRun } = await import(
  "../lib/delivery/scrape-runs/repository.ts"
);
const { processDeliveryListing } = await import(
  "../lib/delivery/orchestrator/processListing.ts"
);
const { getTenantProperty } = await import(
  "../lib/delivery/property-ledger/repository.ts"
);
const { createAdminClient } = await import("../lib/supabase/admin.ts");
const {
  sourceListingIdFromUrl,
  sourceSiteFromUrl,
} = await import("../lib/delivery/property-ledger/identity.ts");
const { buildDeliveryStrReportPdfFilename } = await import(
  "../lib/delivery/reports/pdfFilename.ts"
);
console.log("Haven delivery E2E\n");
console.log("Recipient:", testEmail);
console.log(
  "Resend:",
  process.env.RESEND_API_KEY?.trim()
    ? "configured (will send real email)"
    : "not set (dev log only)",
);
console.log();

const tenant = await upsertDeliveryTenant({
  slug: TENANT_SLUG,
  name: "havenly property (E2E)",
  timezone: "Australia/Brisbane",
  enabled: true,
  scrape_enabled: true,
  scrape_schedule: { type: "interval", intervalHours: 24 },
  partner_sources: [
    {
      label: "SPFN residential search",
      url: SEARCH_URL,
      adapter: "spfn_first_national_v1",
      config: { fetchMethod: "static_fetch", maxPages: 1 },
    },
  ],
  email_recipients: testEmail ? [testEmail] : ["delivery-test@localhost"],
  email_subject_template: "havenly STR test: {{address}}",
  str_template_pack_id: "haven_properties",
  deliverables: ["str"],
  billing_mode: billingMode,
  brand: { displayName: "havenly property" },
  reprocess_on_material_change: false,
});

console.log("Tenant:", tenant.slug, tenant.id);

console.log("\n1. Discovering listings (SPFN, page 1)...");
const discovered = await discoverFromPartnerSource(tenant.partner_sources[0]);
if (!discovered.length) {
  console.error("No listings discovered — abort");
  process.exit(1);
}

const admin = createAdminClient();

/** First discovery URL that is not already delivered (production dedupe behaviour). */
async function pickListingToProcess() {
  for (const item of discovered) {
    const sourceSite = sourceSiteFromUrl(item.listingUrl);
    const sourceListingId = sourceListingIdFromUrl(item.listingUrl, null);
    const existing = await getTenantProperty(
      tenant.id,
      sourceSite,
      sourceListingId,
    );

    if (forceRetest && item === discovered[0]) {
      return { item, sourceSite, sourceListingId, existing, reason: "force" };
    }

    if (!forceRetest) {
      if (!existing || existing.status !== "delivered") {
        return {
          item,
          sourceSite,
          sourceListingId,
          existing,
          reason: existing ? `status=${existing.status}` : "new",
        };
      }
    }
  }

  return null;
}

const picked = await pickListingToProcess();
if (!picked) {
  console.error(
    "All discovered listings are already delivered. Use --force to re-run the first listing.",
  );
  process.exit(1);
}

const { item: target, sourceSite, sourceListingId, existing } = picked;

console.log(
  "   Found",
  discovered.length,
  "— processing next undelivered:",
);
console.log("  ", target.listingUrl);
if (existing?.status === "delivered") {
  console.log("   (ledger: was delivered — use --force to charge Airbtics again)");
}

if (forceRetest || existing?.status === "delivered") {
  await admin
    .from("delivery_tenant_properties")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("source_site", sourceSite)
    .eq("source_listing_id", sourceListingId);
  console.log("\n2. Cleared ledger row for forced re-test");
} else {
  console.log(
    "\n2. Ledger:",
    existing
      ? `existing row (${existing.status}) — will process`
      : "new listing — will process",
  );
}

const run = await createScrapeRun(tenant.id, tenant.billing_mode);
console.log("\n3. Processing listing (REA → STR → PDF → email)...");
console.log("   This may take 2–4 minutes...\n");

const result = await processDeliveryListing({
  tenant,
  listingUrl: target.listingUrl,
  scrapeRunId: run.id,
});

console.log("Outcome:", result);

if (result.outcome === "processed") {
  const { data: prop } = await admin
    .from("delivery_tenant_properties")
    .select("report_id, listing_id, delivery_id")
    .eq("tenant_id", tenant.id)
    .eq("source_listing_id", sourceListingId)
    .maybeSingle();

  if (prop?.report_id) {
    const { data: report } = await admin
      .from("reports")
      .select("pdf_url, final_report_json")
      .eq("id", prop.report_id)
      .maybeSingle();

    console.log("\nReport id:", prop.report_id);
    console.log("PDF URL:", report?.pdf_url ?? "(none)");

    if (report?.pdf_url) {
      try {
        const pdfRes = await fetch(report.pdf_url);
        if (pdfRes.ok) {
          const buf = Buffer.from(await pdfRes.arrayBuffer());
          const finalJson = report.final_report_json;
          const address =
            finalJson?.property?.address?.trim() ||
            [finalJson?.property?.suburb, finalJson?.property?.state]
              .filter(Boolean)
              .join(", ") ||
            "property";
          const pdfFilename = buildDeliveryStrReportPdfFilename({
            tenant,
            address,
          });
          mkdirSync(resolve(ROOT, "tmp"), { recursive: true });
          const out = resolve(ROOT, `tmp/${pdfFilename}`);
          writeFileSync(out, buf);
          console.log("Saved local copy:", out);
        }
      } catch (e) {
        console.warn("Could not save local PDF:", e);
      }
    }
  }
}

if (result.outcome === "failed") {
  process.exit(1);
}

console.log("\nDone.");
