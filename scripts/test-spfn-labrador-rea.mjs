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

const SPFN_URL =
  "https://surfersparadisefn.com.au/buy-residential-real-estate/villa-5-326-342-marine-parade-labrador-qld-11028103561";
const EXPECTED_REA =
  "https://www.realestate.com.au/property-villa-qld-labrador-151311972";

const { fetchStaticHtml } = await import("../lib/scraping/fetchStaticHtml.ts");
const {
  parseSpfnAddressFromListingUrl,
  parseSpfnDetailHtml,
} = await import("../lib/scraping/spfn/parseSpfnListing.ts");
const { findReaListingUrl } = await import("../lib/scraping/rea/findReaListingUrl.ts");
const { findReaListingUrlViaGoogle } = await import(
  "../lib/scraping/rea/findReaListingUrlViaGoogle.ts"
);
const { buildGoogleReaSearchQuery } = await import("../lib/scraping/rea/reaUrlMatch.ts");
const { tryReaBrightDataImport } = await import("../lib/scraping/reaEnrichment.ts");
const { hasBrightDataReaConfig, hasBrightDataUnlockerConfig } = await import(
  "../lib/brightdata/client.ts"
);
const { extractListingFromUrl } = await import("../lib/scraping/extractListing.ts");

console.log("Bright Data REA:", hasBrightDataReaConfig());
console.log("Bright Data Unlocker:", hasBrightDataUnlockerConfig());
console.log();

const slug = parseSpfnAddressFromListingUrl(SPFN_URL);
console.log("Slug parse:", slug);

const html = await fetchStaticHtml(SPFN_URL);
const title = parseSpfnDetailHtml(html);
console.log("Title parse:", title);

const hint = title ?? slug;
console.log("\nGoogle query:", buildGoogleReaSearchQuery(hint ?? {}));

console.log("\nfindReaListingUrlViaGoogle...");
const viaGoogle = await findReaListingUrlViaGoogle({
  address: hint?.address,
  suburb: hint?.suburb,
  state: hint?.state,
  postcode: hint?.postcode,
});
console.log("Via Google:", viaGoogle);

console.log("\nfindReaListingUrl (google + REA site)...");
const found = await findReaListingUrl({
  address: hint?.address,
  suburb: hint?.suburb,
  state: hint?.state,
  postcode: hint?.postcode,
});
console.log("Found:", found);
console.log("Expected:", EXPECTED_REA);
console.log("Match:", found === EXPECTED_REA.replace(/\/$/, ""));

console.log("\ntryReaBrightDataImport...");
const rea = await tryReaBrightDataImport(SPFN_URL, hint);
console.log("used:", rea.used, "reaUrl:", rea.reaUrl);
console.log("warnings:", rea.warnings);

console.log("\nextractListingFromUrl (full)...");
const full = await extractListingFromUrl(SPFN_URL);
console.log("method:", full.method, "parser:", full.parserName);
console.log("address:", full.listing.address);
console.log("warnings:", full.warnings.slice(0, 5));
