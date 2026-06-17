/**
 * Apply the STR estimate intelligence layer (comp-distribution positioning) to
 * an existing report using its stored raw Airbtics JSON — no new Airbtics call.
 * Regenerates copy and the PDF.
 *
 * Usage:
 *   PDF_PRINT_BASE_URL=http://localhost:3000 npx tsx scripts/rerun-str-positioning.mjs <report-id>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const reportId = process.argv[2]?.trim();

if (!reportId) {
  console.error("Usage: npx tsx scripts/rerun-str-positioning.mjs <report-id>");
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
const { normaliseAirbticsResponse } = await import("../lib/airbtics/client.ts");
const { positionStrEstimate } = await import("../lib/airbtics/positionEstimate.ts");
const { buildStrEnrichment } = await import("../lib/airbtics/enrich.ts");
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

if (!report.raw_airbtics_json) {
  console.error("Report has no raw Airbtics JSON to position against.");
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

console.log("Report:", report.id);
console.log("Listing:", listing.property_address);

const medianEstimate = normaliseAirbticsResponse(report.raw_airbtics_json);
console.log("Median estimate:", medianEstimate.annualRevenue);

console.log("\n1. Positioning subject within comp distribution...");
const scrapedListing = listing.scraped_listing_json;
const { estimate: positionedEstimate, positioning } = await positionStrEstimate({
  subject: {
    property_address: listing.property_address ?? scrapedListing?.address ?? null,
    suburb: listing.suburb,
    state: listing.state,
    property_type: listing.property_type ?? scrapedListing?.propertyType ?? null,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    listing_title: listing.listing_title ?? scrapedListing?.title ?? null,
    listing_description:
      listing.listing_description ?? scrapedListing?.description ?? null,
    display_price: listing.display_price,
  },
  estimate: medianEstimate,
});

if (!positioning) {
  console.log("   No positioning applied (guardrails / fallback). Exiting.");
  process.exit(0);
}

console.log("   Percentile:", positioning.percentile);
console.log("   Confidence:", positioning.confidence);
console.log("   LLM revenue:", positioning.llm_annual_revenue ?? "n/a");
console.log("   Final revenue:", positioning.annual_revenue ?? positionedEstimate.annualRevenue);
console.log("   Clamped:", positioning.was_clamped ? "yes" : "no");
if (positioning.comp_anchors) {
  console.log(
    "   Comp band:",
    positioning.comp_anchors.suggested_floor,
    "–",
    positioning.comp_anchors.suggested_ceiling,
    `(same-bed max ${positioning.comp_anchors.same_bed_max})`,
  );
}
console.log("   Rationale:", positioning.rationale);
console.log("   Revenue:", medianEstimate.annualRevenue, "→", positionedEstimate.annualRevenue);

const rebuiltEnrichment = buildStrEnrichment(report.raw_airbtics_json);
const enrichment = rebuiltEnrichment
  ? { ...rebuiltEnrichment, positioning }
  : report.str_enrichment_json
    ? { ...report.str_enrichment_json, positioning }
    : report.str_enrichment_json;

const { data: estimatedReport, error: estimateDbError } = await admin
  .from("reports")
  .update({
    original_estimate_json: medianEstimate,
    final_estimate_json: positionedEstimate,
    user_overrides_json: null,
    str_enrichment_json: enrichment,
  })
  .eq("id", report.id)
  .select("*")
  .single();

if (estimateDbError || !estimatedReport) {
  console.error("Failed to save positioned estimate:", estimateDbError?.message);
  process.exit(1);
}

console.log("\n2. Regenerating copy...");
const agentProfile = await loadListingAgentProfile(admin, listing);
const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
const copy = await generateReportCopy({
  agency,
  listing,
  report: estimatedReport,
  estimate: positionedEstimate,
});

let finalReportJson = resolveFinalReportForDisplay(
  buildFinalReportJson({
    agency,
    agentProfile,
    agencyAgents,
    listing,
    report: estimatedReport,
    estimate: positionedEstimate,
    copy,
    scraped: listing.scraped_listing_json,
  }),
  { templateId: estimatedReport.template_id },
);

finalReportJson = applyTemplateBrandToFinalReport(finalReportJson);

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

await admin
  .from("reports")
  .update({
    pdf_url: pdfUrl,
    final_report_json: {
      ...finalReportJson,
      assets: {
        ...finalReportJson.assets,
        pdf_url: pdfUrl,
      },
    },
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
console.log("Annual revenue:", positionedEstimate.annualRevenue, `(p${positioning.percentile}, was ${medianEstimate.annualRevenue})`);
console.log("Saved:", localOut);
