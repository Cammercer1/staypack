/**
 * Export Haven lease appraisal fixture to PDF via Browserless + public print route
 * (same CSS/image mirroring as STR regenerate-report-pdf / headless delivery).
 *
 * Prerequisites:
 *   - npm run dev (localhost:3000) unless PRINT_BASE_URL points at a deployed app
 *   - BROWSERLESS_API_KEY, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   npx tsx scripts/generate-lease-appraisal-pdf.mjs
 *   npx tsx scripts/generate-lease-appraisal-pdf.mjs --fixture=lib/lease-appraisal/fixtures/haven-ferny-lease-appraisal.json
 *   PRINT_BASE_URL=http://localhost:3000 npx tsx scripts/generate-lease-appraisal-pdf.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PREVIEW_LISTING_ID = "00000000-0000-4000-8000-000000000001";
const PREVIEW_REPORT_ID = "00000000-0000-4000-8000-000000000099";
const PREVIEW_LISTING_SLUG = "ferny-lease-preview";
const PREVIEW_PUBLIC_SLUG = "ferny-lease-appraisal-preview";

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

const fixtureArg = process.argv
  .find((a) => a.startsWith("--fixture="))
  ?.slice("--fixture=".length);
const fixtureRel =
  fixtureArg ?? "lib/lease-appraisal/fixtures/haven-ferny-lease-appraisal.json";
const outRel =
  process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length) ??
  "tmp/havenly-property-lease-appraisal-1401-67-ferny-avenue.pdf";

async function resolveAgency(admin) {
  const fromEnv = process.env.LEASE_APPRAISAL_AGENCY_ID?.trim();
  if (fromEnv) {
    const { data, error } = await admin
      .from("agencies")
      .select("id, slug")
      .eq("id", fromEnv)
      .maybeSingle();
    if (error || !data) {
      throw new Error(`Agency not found for LEASE_APPRAISAL_AGENCY_ID=${fromEnv}`);
    }
    return data;
  }

  const { data: havenAgency, error: havenError } = await admin
    .from("agencies")
    .select("id, slug")
    .or("slug.ilike.%haven%,name.ilike.%haven%")
    .limit(1)
    .maybeSingle();

  if (havenError) throw new Error(havenError.message);
  if (havenAgency?.slug) return havenAgency;

  const { data: anyAgency, error: anyError } = await admin
    .from("agencies")
    .select("id, slug")
    .limit(1)
    .maybeSingle();

  if (anyError || !anyAgency?.slug) {
    throw new Error(
      "No agency in Supabase. Set LEASE_APPRAISAL_AGENCY_ID or create an agency first.",
    );
  }

  return anyAgency;
}

async function main() {
  if (!process.env.BROWSERLESS_API_KEY?.trim()) {
    console.error("BROWSERLESS_API_KEY is required in .env.local");
    process.exit(1);
  }

  const fixturePath = resolve(ROOT, fixtureRel);
  if (!existsSync(fixturePath)) {
    console.error("Fixture not found:", fixturePath);
    process.exit(1);
  }

  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const { applyHavenLeaseAppraisalBrandToReport } = await import(
    "../lib/reports/templates/haven-properties/brand.ts"
  );
  const { HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID } = await import(
    "../lib/reports/templates/ids.ts"
  );
  const { createAdminClient } = await import("../lib/supabase/admin.ts");
  const { getReportsUrl } = await import("../lib/env.ts");
  const { buildPublicReportUrl } = await import("../lib/reports/slugs.ts");
  const {
    renderPdfFromUrl,
    buildPdfImagePath,
    buildPdfStylesheetPath,
  } = await import("../lib/browserless/pdf.ts");
  const { buildLeaseAppraisalPdfFilename } = await import(
    "../lib/delivery/reports/pdfFilename.ts"
  );

  const brandedJson = applyHavenLeaseAppraisalBrandToReport(fixture);
  const property = brandedJson.property ?? {};
  const address =
    property.address?.trim() ||
    [property.suburb, property.state, property.postcode].filter(Boolean).join(", ") ||
    "property";

  const admin = createAdminClient();
  const agency = await resolveAgency(admin);

  const { error: listingError } = await admin.from("listings").upsert(
    {
      id: PREVIEW_LISTING_ID,
      agency_id: agency.id,
      status: "active",
      public_slug: PREVIEW_LISTING_SLUG,
      property_address: property.address ?? address,
      suburb: property.suburb ?? null,
      state: property.state ?? null,
      postcode: property.postcode ?? null,
      property_type: property.property_type ?? null,
      bedrooms: property.bedrooms ?? null,
      bathrooms: property.bathrooms ?? null,
      car_spaces: property.car_spaces ?? null,
      accommodates: property.accommodates ?? null,
      listing_title: brandedJson.copy?.headline ?? null,
      listing_description: brandedJson.copy?.body ?? null,
      display_price: property.display_price ?? null,
      hero_image_url: property.hero_image_url ?? null,
      selected_image_urls: property.selected_image_urls ?? [],
      listing_url: property.listing_url ?? null,
    },
    { onConflict: "id" },
  );

  if (listingError) {
    console.error("Listing upsert failed:", listingError.message);
    process.exit(1);
  }

  const publicUrl = buildPublicReportUrl(
    getReportsUrl(),
    agency.slug,
    PREVIEW_PUBLIC_SLUG,
  );
  const now = new Date().toISOString();

  const { error: reportError } = await admin.from("reports").upsert(
    {
      id: PREVIEW_REPORT_ID,
      agency_id: agency.id,
      listing_id: PREVIEW_LISTING_ID,
      status: "published",
      template_id:
        brandedJson.template_id ?? HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
      final_report_json: brandedJson,
      public_slug: PREVIEW_PUBLIC_SLUG,
      public_url: publicUrl,
      generated_at: now,
      published_at: now,
    },
    { onConflict: "id" },
  );

  if (reportError) {
    console.error("Report upsert failed:", reportError.message);
    process.exit(1);
  }

  const printBase = (
    process.env.PRINT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_REPORTS_URL?.trim() ||
    getReportsUrl()
  ).replace(/\/$/, "");

  const printUrl = `${printBase}/${agency.slug}/${PREVIEW_PUBLIC_SLUG}/print`;

  console.log("Agency:", agency.slug);
  console.log("Report id:", PREVIEW_REPORT_ID);
  console.log("Print URL:", printUrl);
  console.log("Checking print route…");

  const health = await fetch(printUrl, { redirect: "follow" }).catch(() => null);
  if (!health?.ok) {
    console.error(
      `Print route not reachable (${health?.status ?? "network error"}). Start dev server: npm run dev`,
    );
    process.exit(1);
  }

  console.log("Rendering PDF (Browserless + mirrored assets)…");

  const pdfBuffer = await renderPdfFromUrl(printUrl, {
    mirrorImage: async (sourceUrl, buffer, contentType) => {
      const path = buildPdfImagePath(
        agency.id,
        PREVIEW_REPORT_ID,
        sourceUrl,
        contentType,
      );
      const { error } = await admin.storage
        .from("report-assets")
        .upload(path, buffer, { contentType, upsert: true });
      if (error) return null;
      return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
    },
    mirrorStylesheet: async (sourceUrl, buffer, contentType) => {
      const path = buildPdfStylesheetPath(
        agency.id,
        PREVIEW_REPORT_ID,
        sourceUrl,
      );
      const { error } = await admin.storage
        .from("report-assets")
        .upload(path, buffer, { contentType, upsert: true });
      if (error) return null;
      return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
    },
  });

  const pdfFilename = buildLeaseAppraisalPdfFilename("havenly-property", address);
  const outPath = resolve(ROOT, outRel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, pdfBuffer);

  console.log(`Wrote ${outPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
  console.log("Suggested filename:", pdfFilename);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
