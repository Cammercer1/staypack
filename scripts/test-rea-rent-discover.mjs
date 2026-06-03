import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const searchUrl =
  process.argv[2] ??
  "https://www.realestate.com.au/rent/property-unit+apartment-with-2-bedrooms-in-surfers+paradise,+qld+4217/list-1?numParkingSpaces=1&numBaths=2&maxBeds=2&activeSort=list-date&source=refinement";

async function main() {
  const { scrapeBrightDataReaRentDiscover } = await import("../lib/brightdata/client.ts");
  const { parseReaRentDiscoverRecords } = await import(
    "../lib/rental/parseReaRentDiscover.ts"
  );
  const { computeRentBandFromComps, formatWeeklyRentRange } = await import(
    "../lib/rental/computeRentBand.ts"
  );

  console.log("URL:", searchUrl);
  console.log("Discovering (often 1–3 min)…\n");

  const records = await scrapeBrightDataReaRentDiscover({
    searchUrl,
    limitPages: 1,
  });

  writeFileSync(
    resolve(ROOT, "tmp/rea-discover-raw.json"),
    JSON.stringify(records, null, 2),
  );

  console.log("Raw records:", records?.length ?? 0);
  if (records?.[0]) {
    console.log("First record keys:", Object.keys(records[0]));
    console.log("listing_type:", records[0].listing_type);
    console.log("rent_price:", records[0].rent_price);
  }

  const comps = parseReaRentDiscoverRecords(records);
  console.log("Parsed comps:", comps.length);

  const band = computeRentBandFromComps(comps, {
    subjectPropertyType: "Apartment",
    preferSuburb: "Surfers Paradise",
    maxFeaturedComps: 4,
  });

  console.log("Band:", band);
  if (band) {
    console.log("Display:", formatWeeklyRentRange(band.weeklyMin, band.weeklyMax));
  }

  console.log("\nWrote tmp/rea-discover-raw.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
