/**
 * Re-render a published report PDF (fonts, images, template brand) without
 * re-scraping, REA, or a new Airbtics estimate.
 *
 * Usage:
 *   npx tsx scripts/regenerate-report-pdf.mjs <report-id>
 *   npx tsx scripts/regenerate-report-pdf.mjs --tenant havenly-e2e
 *
 * Local dev (report only in your Supabase — dev server must be running):
 *   PRINT_BASE_URL=http://localhost:3000 npx tsx scripts/regenerate-report-pdf.mjs --tenant havenly-e2e
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

const args = process.argv.slice(2);
const tenantFlag = args.indexOf("--tenant");
const tenantSlug =
  tenantFlag >= 0 ? args[tenantFlag + 1]?.trim() : null;
const reportIdArg = args.find(
  (a) => a !== "--tenant" && !a.startsWith("--") && a !== tenantSlug,
);

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { applyTemplateBrandToFinalReport } = await import(
  "../lib/reports/applyTemplateBrand.ts"
);
const { refreshStrEnrichmentInFinalReport } = await import(
  "../lib/airbtics/enrich.ts"
);
const { buildStrReportPdfFilename } = await import(
  "../lib/delivery/reports/pdfFilename.ts"
);
const {
  renderPdfFromUrl,
  buildPdfImagePath,
  buildPdfStylesheetPath,
} = await import("../lib/browserless/pdf.ts");
const { getReportsUrl } = await import("../lib/env.ts");
const { cacheBustedPdfUrl } = await import(
  "../lib/reports/cacheBustedPdfUrl.ts"
);

const admin = createAdminClient();

async function resolveReportId() {
  if (reportIdArg) return reportIdArg;

  if (!tenantSlug) {
    console.error(
      "Usage: npx tsx scripts/regenerate-report-pdf.mjs <report-id>",
    );
    console.error(
      "   or: npx tsx scripts/regenerate-report-pdf.mjs --tenant havenly-e2e",
    );
    process.exit(1);
  }

  const { data: tenant, error: tenantError } = await admin
    .from("delivery_tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (tenantError || !tenant) {
    console.error("Tenant not found:", tenantSlug, tenantError?.message);
    process.exit(1);
  }

  const { data: row, error: propError } = await admin
    .from("delivery_tenant_properties")
    .select("report_id")
    .eq("tenant_id", tenant.id)
    .not("report_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (propError || !row?.report_id) {
    console.error("No delivered report for tenant:", tenantSlug);
    process.exit(1);
  }

  return row.report_id;
}

const reportId = await resolveReportId();

const { data: report, error: reportError } = await admin
  .from("reports")
  .select("id, agency_id, public_slug, status, final_report_json, raw_airbtics_json, pdf_url")
  .eq("id", reportId)
  .maybeSingle();

if (reportError || !report) {
  console.error("Report not found:", reportId, reportError?.message);
  process.exit(1);
}

if (!report.public_slug) {
  console.error("Report is not published (missing public_slug).");
  process.exit(1);
}

if (!report.final_report_json) {
  console.error("Report has no final_report_json.");
  process.exit(1);
}

const { data: agency, error: agencyError } = await admin
  .from("agencies")
  .select("slug")
  .eq("id", report.agency_id)
  .maybeSingle();

if (agencyError || !agency?.slug) {
  console.error("Agency not found for report");
  process.exit(1);
}

const brandedJson = applyTemplateBrandToFinalReport(
  refreshStrEnrichmentInFinalReport(
    report.final_report_json,
    report.raw_airbtics_json,
  ),
);

const { error: patchError } = await admin
  .from("reports")
  .update({ final_report_json: brandedJson })
  .eq("id", report.id);

if (patchError) {
  console.error("Could not patch final_report_json:", patchError.message);
  process.exit(1);
}

const printBase = (
  process.env.PRINT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_REPORTS_URL?.trim() ||
  getReportsUrl()
).replace(/\/$/, "");

const printUrl = `${printBase}/${agency.slug}/${report.public_slug}/print`;

console.log("Report id:", report.id);
console.log("Print URL:", printUrl);
console.log("Re-rendering PDF (Browserless)…\n");

const pdfBuffer = await renderPdfFromUrl(printUrl, {
  mirrorImage: async (sourceUrl, buffer, contentType) => {
    const path = buildPdfImagePath(
      report.agency_id,
      report.id,
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
      report.agency_id,
      report.id,
      sourceUrl,
    );
    const { error } = await admin.storage
      .from("report-assets")
      .upload(path, buffer, { contentType, upsert: true });
    if (error) return null;
    return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
  },
});

const pdfPath = `${report.agency_id}/${report.id}/delivery-report.pdf`;
const { error: uploadError } = await admin.storage
  .from("report-pdfs")
  .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

if (uploadError) {
  console.error("PDF upload failed:", uploadError.message);
  process.exit(1);
}

const { data: pdfPublic } = admin.storage.from("report-pdfs").getPublicUrl(pdfPath);
const pdfUrl = cacheBustedPdfUrl(pdfPublic.publicUrl, Date.now());

await admin
  .from("reports")
  .update({
    pdf_url: pdfUrl,
    final_report_json: {
      ...brandedJson,
      assets: {
        ...(brandedJson.assets ?? {}),
        pdf_url: pdfUrl,
      },
    },
  })
  .eq("id", report.id);

const address =
  brandedJson.property?.address?.trim() ||
  [
    brandedJson.property?.suburb,
    brandedJson.property?.state,
    brandedJson.property?.postcode,
  ]
    .filter(Boolean)
    .join(", ") ||
  "property";
const brandPrefix =
  brandedJson.template_id === "haven-properties-str"
    ? "havenly-property"
    : "str-report";
const pdfFilename = buildStrReportPdfFilename(brandPrefix, address);

mkdirSync(resolve(ROOT, "tmp"), { recursive: true });
const localOut = resolve(ROOT, `tmp/${pdfFilename}`);
writeFileSync(localOut, pdfBuffer);

console.log("Done.");
console.log("Filename:", pdfFilename);
console.log("Local file:", localOut);
console.log("Supabase PDF:", pdfUrl);
