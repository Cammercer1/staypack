/**
 * Regenerate STR, lease, and sales brochure copy for a listing.
 * Usage: npx tsx scripts/regenerate-listing-copy.mjs <listingId>
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listingId = process.argv[2];

if (!listingId) {
  console.error("Usage: npx tsx scripts/regenerate-listing-copy.mjs <listingId>");
  process.exit(1);
}

if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { generateReportCopy } = await import("../lib/openai/generateReportCopy.ts");
const { buildFinalReportJson } = await import("../lib/reports/buildFinalReportJson.ts");
const { resolveFinalReportForDisplay } = await import("../lib/reports/resolveFinalReportForDisplay.ts");
const { resolveReportEstimate } = await import("../lib/reports/normalizeEstimate.ts");
const { loadAgencyAgentProfiles, loadListingAgentProfile } = await import("../lib/reports/loadReportAgent.ts");
const { generateLeaseAppraisalReportContent } = await import("../lib/lease-appraisal/generateLeaseAppraisalForListing.ts");
const { generateSalesBrochureCopy } = await import("../lib/openai/generateSalesBrochureCopy.ts");
const { buildSalesBrochureDocument } = await import("../lib/collateral/buildSalesBrochureDocument.ts");
const { withBrochureContentSaved } = await import("../lib/collateral/sales-brochure/brochurePublishSync.ts");
const { isBrochureDocument } = await import("../lib/collateral/templates/types.ts");
const { variantTextToParagraphs } = await import("../lib/copy/blurbVariantEnforce.ts");

function summarizeVariants(label, variants) {
  if (!variants) {
    console.log(`  ${label}: no blurb_variants`);
    return;
  }
  console.log(
    `  ${label}: short=${variantTextToParagraphs(variants.short).length} medium=${variantTextToParagraphs(variants.medium).length} long=${variantTextToParagraphs(variants.long).length}`,
  );
}

const admin = createAdminClient();

const { data: listing, error: listingError } = await admin
  .from("listings")
  .select("*")
  .eq("id", listingId)
  .single();

if (listingError || !listing) {
  console.error("Listing not found:", listingError?.message ?? listingId);
  process.exit(1);
}

const { data: agency, error: agencyError } = await admin
  .from("agencies")
  .select("*")
  .eq("id", listing.agency_id)
  .single();

if (agencyError || !agency) {
  console.error("Agency not found:", agencyError?.message);
  process.exit(1);
}

const { data: collaterals } = await admin
  .from("collateral_items")
  .select("*")
  .eq("listing_id", listingId)
  .neq("status", "archived");

const strCollateral = collaterals?.find((c) => c.type === "str_report");
const leaseCollateral = collaterals?.find((c) => c.type === "lease_appraisal");
const salesCollateral = collaterals?.find((c) => c.type === "sales_brochure");

console.log("Listing:", listing.property_address);
console.log("");

// --- STR ---
if (strCollateral?.report_id) {
  console.log("Regenerating STR...");
  const { data: report } = await admin
    .from("reports")
    .select("*")
    .eq("id", strCollateral.report_id)
    .single();

  if (!report) {
    console.error("  STR report not found");
  } else {
    const estimate = resolveReportEstimate(report);
    if (!estimate) {
      console.error("  STR skipped: no estimate on report");
    } else {
      const agentProfile = await loadListingAgentProfile(admin, listing);
      const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
      const copy = await generateReportCopy({
        agency,
        listing,
        report,
        estimate,
      });
      const finalReportJson = resolveFinalReportForDisplay(
        buildFinalReportJson({
          agency,
          agentProfile,
          agencyAgents,
          listing,
          report,
          estimate,
          copy,
          scraped: listing.scraped_listing_json,
        }),
        { templateId: report.template_id },
      );

      await admin
        .from("reports")
        .update({
          ai_copy_json: copy,
          final_report_json: finalReportJson,
          status: "generated",
          generated_at: new Date().toISOString(),
        })
        .eq("id", report.id);

      summarizeVariants("STR ai_copy", copy.sales_pack_blurb_variants);
      summarizeVariants("STR final_report", finalReportJson.copy.blurb_variants);
      console.log("  STR done");
    }
  }
} else {
  console.log("STR: no str_report collateral");
}

console.log("");

// --- Lease ---
if (leaseCollateral?.report_id) {
  console.log("Regenerating lease appraisal...");
  const { data: report } = await admin
    .from("reports")
    .select("*")
    .eq("id", leaseCollateral.report_id)
    .single();

  if (!report) {
    console.error("  Lease report not found");
  } else {
    const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
    const result = await generateLeaseAppraisalReportContent({
      supabase: admin,
      agency,
      listing,
      report,
      agencyAgents,
    });
    const finalCopy = result.report.final_report_json?.copy;
    summarizeVariants("Lease final_report", finalCopy?.blurb_variants);
    console.log("  Lease done");
  }
} else {
  console.log("Lease: no lease_appraisal collateral");
}

console.log("");

// --- Sales brochure ---
if (salesCollateral) {
  console.log("Regenerating sales brochure...");
  const agentProfile = await loadListingAgentProfile(admin, listing);
  const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
  const copy = await generateSalesBrochureCopy({ agency, listing });
  const built = buildSalesBrochureDocument({
    agency,
    listing,
    collateral: salesCollateral,
    copy,
    agentProfile,
    agencyAgents,
    qrCodeUrl: salesCollateral.document_json?.assets?.qr_code_url ?? "",
    qrTargetUrl: salesCollateral.document_json?.qr_target_url ?? "",
  });

  const existing = salesCollateral.document_json;
  const documentJson = withBrochureContentSaved(
    existing && isBrochureDocument(existing)
      ? {
          ...built,
          property: {
            ...built.property,
            hero_image_url: existing.property.hero_image_url,
            selected_image_urls: existing.property.selected_image_urls,
            page_one_image_urls: existing.property.page_one_image_urls,
            page_two_image_urls: existing.property.page_two_image_urls,
          },
        }
      : built,
  );

  await admin
    .from("collateral_items")
    .update({
      document_json: documentJson,
      status: salesCollateral.status === "published" ? "published" : "generated",
      generated_at: new Date().toISOString(),
    })
    .eq("id", salesCollateral.id);

  summarizeVariants("Sales document", documentJson.copy?.blurb_variants);
  console.log("  Sales done");
} else {
  console.log("Sales: no sales_brochure collateral");
}

console.log("\nAll regeneration complete.");
