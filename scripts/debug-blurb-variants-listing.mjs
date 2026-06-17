/**
 * Inspect blurb_variants paragraph counts per collateral type for a listing.
 * Usage: npx tsx scripts/debug-blurb-variants-listing.mjs <listingId>
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listingId = process.argv[2];
if (!listingId) {
  console.error("Usage: npx tsx scripts/debug-blurb-variants-listing.mjs <listingId>");
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
const { variantTextToParagraphs } = await import("../lib/copy/blurbVariantEnforce.ts");

function countParas(text) {
  if (!text || typeof text !== "string") return 0;
  return variantTextToParagraphs(text).length;
}

function summarizeVariants(variants) {
  if (!variants) {
    return { hasVariants: false, short: 0, medium: 0, long: 0, allSameText: null };
  }
  return {
    hasVariants: true,
    short: countParas(variants.short),
    medium: countParas(variants.medium),
    long: countParas(variants.long),
    allSameText:
      variants.short === variants.medium && variants.medium === variants.long,
  };
}

const admin = createAdminClient();
const { data: listing, error } = await admin
  .from("listings")
  .select("id, property_address")
  .eq("id", listingId)
  .single();

if (error || !listing) {
  console.error("Listing not found:", error?.message ?? listingId);
  process.exit(1);
}

console.log("Listing:", listing.property_address);

const { data: collaterals } = await admin
  .from("collateral_items")
  .select("id, type, report_id, document_json")
  .eq("listing_id", listingId)
  .neq("status", "archived");

const items = collaterals ?? [];
const strC = items.find((c) => c.type === "str_report");
const leaseC = items.find((c) => c.type === "lease_appraisal");
const salesC = items.find((c) => c.type === "sales_brochure");

const out = { str: null, lease: null, sales: null };

async function loadReportCopy(reportId) {
  const { data: report } = await admin
    .from("reports")
    .select("id, ai_copy_json, final_report_json")
    .eq("id", reportId)
    .single();
  if (!report) return null;
  const copy = report.final_report_json?.copy ?? report.ai_copy_json;
  return {
    reportId: report.id,
    source: report.final_report_json?.copy ? "final_report_json" : "ai_copy_json",
    copy,
    variants: summarizeVariants(copy?.blurb_variants),
  };
}

if (strC?.report_id) {
  out.str = await loadReportCopy(strC.report_id);
}

if (leaseC?.report_id) {
  out.lease = await loadReportCopy(leaseC.report_id);
}

if (salesC?.document_json?.copy) {
  const copy = salesC.document_json.copy;
  out.sales = {
    collateralId: salesC.id,
    source: "collateral document_json",
    variants: summarizeVariants(copy.blurb_variants),
  };
} else if (salesC) {
  out.sales = {
    collateralId: salesC.id,
    source: "collateral exists but no document_json.copy",
    variants: { hasVariants: false, short: 0, medium: 0, long: 0, allSameText: null },
  };
}

if (!out.str) {
  const { data: reports } = await admin
    .from("reports")
    .select("id, ai_copy_json, final_report_json")
    .eq("listing_id", listingId)
    .order("updated_at", { ascending: false });

  for (const r of reports ?? []) {
    if (leaseC?.report_id && r.id === leaseC.report_id) continue;
    const copy = r.final_report_json?.copy ?? r.ai_copy_json;
    if (copy) {
      out.str = {
        reportId: r.id,
        source: r.final_report_json?.copy ? "final_report_json" : "ai_copy_json",
        copy,
        variants: summarizeVariants(copy.blurb_variants),
      };
      break;
    }
  }
}

const expected = { short: 1, medium: 2, long: 3 };
for (const [key, row] of Object.entries(out)) {
  if (!row) {
    console.log(`\n${key.toUpperCase()}: no data`);
    continue;
  }
  const v = row.variants;
  const ok =
    v.hasVariants &&
    v.short >= expected.short &&
    v.medium >= expected.medium &&
    v.long >= expected.long &&
    !v.allSameText;
  console.log(`\n${key.toUpperCase()}:`, JSON.stringify({ ...row, copy: undefined }, null, 2));
  console.log(
    `  → Has proper 3-tier variants (1/2/3 paras, distinct): ${ok ? "YES" : "NO"}`,
  );
}
