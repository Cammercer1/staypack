/** Usage: npx tsx scripts/debug-apify-rea-url.mjs "<rea-rent-search-url>" */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scripts/debug-apify-rea-url.mjs <rea-rent-search-url>");
  process.exit(1);
}

if (existsSync(resolve(ROOT, ".env.local"))) {
  for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const { scrapeApifyReaRentSearch } = await import("../lib/apify/client.ts");
const { parseApifyReaListings } = await import("../lib/rental/parseApifyReaListings.ts");

const records = await scrapeApifyReaRentSearch({ searchUrl: url, maxItems: 50 });
const comps = parseApifyReaListings(records);
const rents = comps.map((c) => c.weeklyRent).sort((a, b) => a - b);
const n = rents.length;
const median = n
  ? n % 2
    ? rents[(n - 1) / 2]
    : (rents[n / 2 - 1] + rents[n / 2]) / 2
  : 0;
const suburbs = [...new Set(comps.map((c) => c.suburb).filter(Boolean))];

console.log("Total listings (Apify):", records.length);
console.log("Parsed weekly rent comps:", n);
console.log("Median weekly rent: $" + Math.round(median));
if (n) console.log("Range: $" + rents[0] + " – $" + rents[n - 1] + "/wk");
console.log("Suburbs:", suburbs.join(", "));
console.log("");
for (const c of [...comps].sort((a, b) => a.weeklyRent - b.weeklyRent)) {
  console.log(
    "  $" + c.weeklyRent + "/wk | " + (c.propertyType ?? "?") + " | " + (c.suburb ?? "") + " | " + c.address,
  );
}
