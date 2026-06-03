/**
 * End-to-end probe: SPFN discover → address parse → REA import (if configured).
 * Usage: npx tsx scripts/test-spfn-pipeline.mjs
 */
import { readFileSync, existsSync } from "node:fs";
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

const SEARCH_URL =
  "https://surfersparadisefn.com.au/real-estate-search/residential-real-estate?ltype=1&page=1&sort=date-desc";

const { discoverFromPartnerSource } = await import(
  "../lib/delivery/scrape/adapters/index.ts"
);
const { parseSpfnDetailHtml, parseSpfnAddressFromListingUrl } = await import(
  "../lib/scraping/spfn/parseSpfnListing.ts"
);
const { fetchStaticHtml } = await import("../lib/scraping/fetchStaticHtml.ts");
const { tryReaBrightDataImport } = await import(
  "../lib/scraping/reaEnrichment.ts"
);
const { hasBrightDataReaConfig } = await import("../lib/brightdata/client.ts");

const discovered = await discoverFromPartnerSource({
  url: SEARCH_URL,
  adapter: "spfn_first_national_v1",
  config: { maxPages: 1 },
});

console.log("Discovered", discovered.length, "listings");
console.log("Method:", discovered[0]?.discoveryMethod);

const sample =
  discovered.find((d) => d.listingUrl.includes("ferny-avenue-surfers-paradise"))?.listingUrl ??
  discovered[0]?.listingUrl;
if (!sample) {
  console.log("No listings — abort");
  process.exit(1);
}

console.log("\nSample URL:", sample);

const slugParsed = parseSpfnAddressFromListingUrl(sample);
console.log("\nFrom slug:", slugParsed);

const html = await fetchStaticHtml(sample);
const fromTitle = parseSpfnDetailHtml(html);
console.log("\nFrom detail title:", fromTitle);

const hint = fromTitle ?? slugParsed;
if (hasBrightDataReaConfig()) {
  const rea = await tryReaBrightDataImport(sample, hint);
  console.log("\nREA import used:", rea.used);
  if (rea.used) {
    console.log("REA address:", rea.listing.address);
    console.log("Beds:", rea.listing.bedrooms, "Images:", rea.listing.images?.length);
    console.log("REA URL:", rea.reaUrl);
  } else {
    console.log("REA warnings:", rea.warnings);
  }
} else {
  console.log("\nSkipping REA (BRIGHTDATA_API_KEY / dataset not configured)");
}
