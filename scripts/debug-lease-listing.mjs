import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listingId = process.argv[2] ?? "f8a125c4-aa7b-46b9-b6c0-1bf4bd1ed18d";

if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { createAdminClient } = await import("../lib/supabase/admin.ts");
const admin = createAdminClient();

const { data: listing, error } = await admin
  .from("listings")
  .select("id, property_address, agency_id, scraped_listing_json")
  .eq("id", listingId)
  .single();

if (error || !listing) {
  console.error("Listing not found:", error?.message ?? listingId);
  process.exit(1);
}

console.log("Listing:", listing.property_address);
console.log("Has scraped_listing_json:", Boolean(listing.scraped_listing_json));

const { data: collaterals } = await admin
  .from("collateral_items")
  .select("id, type, report_id, template_id, status")
  .eq("listing_id", listingId);

console.log("\nCollaterals:");
for (const c of collaterals ?? []) {
  console.log(`  ${c.type} report=${c.report_id} template=${c.template_id} status=${c.status}`);
}

const { data: reports } = await admin
  .from("reports")
  .select("id, template_id, updated_at, final_report_json, ai_copy_json")
  .eq("listing_id", listingId)
  .order("updated_at", { ascending: false });

console.log("\nReports:");
for (const r of reports ?? []) {
  console.log(
    `  ${r.id} template=${r.template_id} final=${Boolean(r.final_report_json)} copy=${Boolean(r.ai_copy_json)} updated=${r.updated_at}`,
  );
}
