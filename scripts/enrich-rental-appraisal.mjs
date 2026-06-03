/**
 * Run REA property scrape + rent discover for a listing URL.
 *
 * Usage:
 *   npx tsx scripts/enrich-rental-appraisal.mjs "<listing url>"
 *   npx tsx scripts/enrich-rental-appraisal.mjs --from-json ~/Downloads/sd_mpuu1la37xa3f8twa.json
 *
 * Requires .env.local: BRIGHTDATA_API_KEY, BRIGHTDATA_REA_DATASET_ID
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

const fromJson = process.argv.includes("--from-json");
const jsonPath = process.argv[process.argv.indexOf("--from-json") + 1];
const url = process.argv.find((a) => a.startsWith("http"));

async function main() {
  if (fromJson && jsonPath) {
    const { parseReaRentDiscoverRecords } = await import(
      "../lib/rental/parseReaRentDiscover.ts"
    );
    const { computeRentBandFromComps } = await import(
      "../lib/rental/computeRentBand.ts"
    );
    const { formatWeeklyRentRange } = await import(
      "../lib/rental/computeRentBand.ts"
    );
    const raw = JSON.parse(readFileSync(resolve(jsonPath), "utf8"));
    const comps = parseReaRentDiscoverRecords(raw);
    const band = computeRentBandFromComps(comps, { maxFeaturedComps: 4 });
    console.log("Comps:", comps.length);
    console.log("Band:", band);
    if (band) {
      console.log("Display:", formatWeeklyRentRange(band.weeklyMin, band.weeklyMax));
    }
    return;
  }

  if (!url) {
    console.error(
      "Usage: npx tsx scripts/enrich-rental-appraisal.mjs <listing url>",
    );
    process.exit(1);
  }

  const { extractListingFromUrl } = await import("../lib/scraping/extractListing.ts");
  const { resolveRentalDisplayPrice } = await import(
    "../lib/rental/formatRentalDisplayPrice.ts"
  );

  console.log("URL:", url);
  console.log("Step 1–2: REA listing scrape + rent discover (may take 2–3 min)…\n");

  const result = await extractListingFromUrl(url, { enrichRentalAppraisal: true });

  console.log(JSON.stringify({
    address: result.listing.address,
    bedrooms: result.listing.bedrooms,
    rentalAppraisal: result.listing.rentalAppraisal,
    ltrSuburbMarket: result.listing.ltrSuburbMarket,
    displayPrice: resolveRentalDisplayPrice(result.listing),
    rentalComps: result.listing.rentalComps,
    imageCount: result.listing.images?.length,
    warnings: result.listing.warnings,
    method: result.method,
    parserName: result.parserName,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
