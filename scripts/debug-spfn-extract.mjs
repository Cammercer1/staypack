/**
 * Debug SPFN discovery + delivery extract for first listing.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEARCH =
  "https://surfersparadisefn.com.au/real-estate-search/residential-real-estate?ltype=1&page=1&sort=date-desc";

if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim().replace(/^[\"']|[\"']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const { discoverFromPartnerSource } = await import(
  "../lib/delivery/scrape/adapters/index.ts"
);
const { extractListingForDelivery } = await import(
  "../lib/scraping/extractListingForDelivery.ts"
);

console.log("1. Discovery…");
const t0 = Date.now();
const discovered = await discoverFromPartnerSource({
  url: SEARCH,
  adapter: "spfn_first_national_v1",
  config: { fetchMethod: "static_fetch", maxPages: 1, max_listings: 5 },
});
console.log(`   ${discovered.length} URLs in ${Date.now() - t0}ms`);
const url = discovered[0]?.listingUrl;
if (!url) process.exit(1);
console.log("   First:", url);

console.log("\n2. extractListingForDelivery…");
const t1 = Date.now();
try {
  const result = await extractListingForDelivery(url);
  console.log(`   ${Date.now() - t1}ms`, result.ok ? "OK" : "FAIL", result.ok ? result.method : result.reason);
  if (!result.ok) {
    console.log("   warnings:", result.warnings?.slice(-8));
  } else {
    console.log("   address:", result.listing.address);
    console.log("   images:", result.listing.images?.length);
  }
} catch (e) {
  console.log(`   ${Date.now() - t1}ms THREW`, e instanceof Error ? e.message : e);
}
