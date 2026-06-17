/**
 * Re-run STR estimate + copy + PDF after correcting bedroom count.
 *
 * Usage:
 *   PDF_PRINT_BASE_URL=http://localhost:3000 npx tsx scripts/rerun-str-report-beds.mjs <report-id> <bedrooms>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const reportId = process.argv[2]?.trim();
const bedrooms = Number(process.argv[3]);

if (!reportId || !Number.isFinite(bedrooms) || bedrooms < 1) {
  console.error(
    "Usage: npx tsx scripts/rerun-str-report-beds.mjs <report-id> <bedrooms>",
  );
  process.exit(1);
}

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

if (process.env.PRINT_BASE_URL?.trim()) {
  process.env.PDF_PRINT_BASE_URL = process.env.PRINT_BASE_URL.trim();
}

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { fetchAirbticsEstimate } = await import("../lib/airbtics/client.ts");
const { calculateAccommodates } = await import("../lib/reports/formatters.ts");
const { generateReportCopy } = await import("../lib/openai/generateReportCopy.ts");
const { buildFinalReportJson } = await import("../lib/reports/buildFinalReportJson.ts");
const { resolveFinalReportForDisplay } = await import(
  "../lib/reports/resolveFinalReportForDisplay.ts"
);
const { loadAgencyAgentProfiles, loadListingAgentProfile } = await import(
  "../lib/reports/loadReportAgent.ts"
);
const { applyTemplateBrandToFinalReport } = await import(
  "../lib/reports/applyTemplateBrand.ts"
);
const { refreshStrEnrichmentInFinalReport } = await import(
  "../lib/airbtics/enrich.ts"
);
const {
  renderPdfFromUrl,
  buildPdfImagePath,
  buildPdfStylesheetPath,
} = await import("../lib/browserless/pdf.ts");
const { getPrintRenderBaseUrl } = await import("../lib/env.ts");
const { cacheBustedPdfUrl } = await import("../lib/reports/cacheBustedPdfUrl.ts");
const { buildStrReportPdfFilename } = await import(
  "../lib/delivery/reports/pdfFilename.ts"
);

const admin = createAdminClient();

const { data: report, error: reportError } = await admin
  .from("reports")
  .select("*")
  .eq("id", reportId)
  .maybeSingle();

if (reportError || !report) {
  console.error("Report not found:", reportId, reportError?.message);
  process.exit(1);
}

const { data: listing, error: listingError } = await admin
  .from("listings")
  .select("*")
  .eq("id", report.listing_id)
  .maybeSingle();

if (listingError || !listing) {
  console.error("Listing not found:", listingError?.message);
  process.exit(1);
}

const { data: agency, error: agencyError } = await admin
  .from("agencies")
  .select("*")
  .eq("id", report.agency_id)
  .maybeSingle();

if (agencyError || !agency) {
  console.error("Agency not found:", agencyError?.message);
  process.exit(1);
}

const bathrooms = Number(listing.bathrooms ?? 1);
const accommodates = calculateAccommodates(bedrooms, null);
const scraped = listing.scraped_listing_json
  ? { ...listing.scraped_listing_json, bedrooms }
  : { bedrooms };

console.log("Report:", report.id);
console.log("Listing:", listing.property_address);
console.log("Updating bedrooms:", listing.bedrooms, "→", bedrooms);
console.log("Accommodates:", accommodates);
console.log();

if (listing.latitude == null || listing.longitude == null) {
  console.error("Listing is missing coordinates");
  process.exit(1);
}

await admin
  .from("listings")
  .update({
    bedrooms,
    accommodates,
    scraped_listing_json: scraped,
  })
  .eq("id", listing.id);

const listingForEstimate = { ...listing, bedrooms, accommodates, scraped_listing_json: scraped };

console.log("1. Re-running Airbtics estimate (full tier)...");
const estimateResult = await fetchAirbticsEstimate(
  {
    latitude: listing.latitude,
    longitude: listing.longitude,
    bedrooms,
    bathrooms,
    accommodates,
  },
  "full",
);

const { estimate, tier, reportId: airbticsReportId, costCents, enrichment } =
  estimateResult;

console.log("   Annual revenue:", estimate.annualRevenue);

const { data: estimatedReport, error: estimateDbError } = await admin
  .from("reports")
  .update({
    airbtics_tier: tier,
    airbtics_report_id: airbticsReportId,
    airbtics_cost_cents: costCents,
    airbtics_fetched_at: new Date().toISOString(),
    original_estimate_json: estimate,
    final_estimate_json: estimate,
    user_overrides_json: null,
    raw_airbtics_json: estimate.raw,
    str_enrichment_json: enrichment,
    status: "estimated",
  })
  .eq("id", report.id)
  .select("*")
  .single();

if (estimateDbError || !estimatedReport) {
  console.error("Failed to save estimate:", estimateDbError?.message);
  process.exit(1);
}

console.log("\n2. Regenerating copy...");
const agentProfile = await loadListingAgentProfile(admin, listingForEstimate);
const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
const copy = await generateReportCopy({
  agency,
  listing: listingForEstimate,
  report: estimatedReport,
  estimate,
});

let finalReportJson = resolveFinalReportForDisplay(
  buildFinalReportJson({
    agency,
    agentProfile,
    agencyAgents,
    listing: listingForEstimate,
    report: estimatedReport,
    estimate,
    copy,
    scraped,
  }),
  { templateId: estimatedReport.template_id },
);

finalReportJson = applyTemplateBrandToFinalReport(
  refreshStrEnrichmentInFinalReport(finalReportJson, estimate.raw),
);

const publishedAssets = report.final_report_json?.assets ?? {};
finalReportJson = {
  ...finalReportJson,
  assets: {
    ...finalReportJson.assets,
    qr_code_url: publishedAssets.qr_code_url ?? finalReportJson.assets?.qr_code_url,
    pdf_url: publishedAssets.pdf_url ?? finalReportJson.assets?.pdf_url,
  },
};

await admin
  .from("reports")
  .update({
    ai_copy_json: copy,
    final_report_json: finalReportJson,
    status: report.public_slug ? "published" : "generated",
    generated_at: new Date().toISOString(),
  })
  .eq("id", report.id);

if (!report.public_slug) {
  console.log("\nReport is not published — skipping PDF.");
  process.exit(0);
}

console.log("\n3. Re-rendering PDF...");
const printUrl = `${getPrintRenderBaseUrl().replace(/\/$/, "")}/${agency.slug}/${report.public_slug}/print`;
console.log("   Print URL:", printUrl);

const pdfBuffer = await renderPdfFromUrl(printUrl, {
  mirrorImage: async (sourceUrl, buffer, contentType) => {
    const path = buildPdfImagePath(report.agency_id, report.id, sourceUrl, contentType);
    const { error } = await admin.storage
      .from("report-assets")
      .upload(path, buffer, { contentType, upsert: true });
    if (error) return null;
    return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
  },
  mirrorStylesheet: async (sourceUrl, buffer, contentType) => {
    const path = buildPdfStylesheetPath(report.agency_id, report.id, sourceUrl);
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

const finalWithPdf = {
  ...finalReportJson,
  assets: {
    ...finalReportJson.assets,
    pdf_url: pdfUrl,
  },
};

await admin
  .from("reports")
  .update({
    pdf_url: pdfUrl,
    final_report_json: finalWithPdf,
  })
  .eq("id", report.id);

const address =
  [listing.property_address, listing.suburb, listing.state].filter(Boolean).join(", ") ||
  "property";
const brandPrefix =
  estimatedReport.template_id === "haven-properties-str"
    ? "havenly-property"
    : "str-report";
const pdfFilename = buildStrReportPdfFilename(brandPrefix, address);

mkdirSync(resolve(ROOT, "tmp"), { recursive: true });
const localOut = resolve(ROOT, `tmp/${pdfFilename}`);
writeFileSync(localOut, pdfBuffer);

console.log("\nDone.");
console.log("Public URL:", report.public_url);
console.log("Annual revenue:", estimate.annualRevenue);
console.log("Saved:", localOut);
