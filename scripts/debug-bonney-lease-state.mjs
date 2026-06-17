import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim().replace(/^[\"']|[\"']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const admin = createAdminClient();
const slug = process.argv[2] ?? "726991b4";
const { data: report } = await admin
  .from("reports")
  .select("listing_id, final_report_json")
  .eq("public_slug", slug)
  .maybeSingle();
if (!report) {
  console.log("Report not found:", slug);
  process.exit(1);
}
const fr = report.final_report_json;
console.log("ltr:", fr.ltr);
console.log("ltr_enrichment comp_count:", fr.ltr_enrichment?.comp_count);
const { data: listing } = await admin
  .from("listings")
  .select("scraped_listing_json, property_address")
  .eq("id", report.listing_id)
  .single();
const s = listing?.scraped_listing_json;
console.log("address:", listing?.property_address);
console.log("rentalAppraisal:", s?.rentalAppraisal);
console.log("rentalComps:", s?.rentalComps?.length ?? 0);
console.log(
  "rent warnings:",
  (s?.warnings ?? []).filter((w) => /rent|Rental|REA/i.test(w)),
);
