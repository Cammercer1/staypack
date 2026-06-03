/**
 * Probe Domain property-profile pages for rent/estimate data.
 * Usage: npx tsx scripts/probe-domain-property-profile.mjs [url]
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

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

const url =
  process.argv[2]?.trim() ||
  "https://www.domain.com.au/property-profile/5-326-342-marine-parade-labrador-qld-4215";

function inspect(html, label) {
  const len = html?.length ?? 0;
  const hasNext = html?.includes("__NEXT_DATA__");
  console.log(`\n=== ${label} ===`);
  console.log({ bytes: len, hasNextData: hasNext });

  if (!html || len < 500) {
    console.log("snippet:", html?.slice(0, 400)?.replace(/\s+/g, " "));
    return null;
  }

  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").text();
  if (!raw) {
    console.log("No __NEXT_DATA__");
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.log("Failed to parse __NEXT_DATA__ JSON");
    return null;
  }

  const pageProps = parsed?.props?.pageProps ?? {};
  const cp = pageProps?.componentProps;
  const pageKeys = Object.keys(pageProps);
  console.log("pageProps keys:", pageKeys.slice(0, 30));

  if (cp && typeof cp === "object") {
    console.log("componentProps keys:", Object.keys(cp).slice(0, 50));
  } else {
    console.log("componentProps:", typeof cp);
  }

  const blob = JSON.stringify(pageProps).toLowerCase();
  for (const term of [
    "rentalestimate",
    "estimatedrent",
    "weeklyrent",
    "rentrange",
    "comparable",
    "medianrent",
    "propertyprofile",
    "rentalbond",
    "priceestimate",
  ]) {
    if (blob.includes(term.replace(/_/g, ""))) {
      console.log("JSON mentions:", term);
    }
  }

  // Walk for rent-like numeric structures
  const hits = [];
  function walk(obj, path, depth) {
    if (!obj || depth > 8 || hits.length > 30) return;
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      if (/rent|estimate|valuation|comparable|weekly|median|bond/i.test(k)) {
        const preview =
          typeof v === "object"
            ? Array.isArray(v)
              ? `array[${v.length}]`
              : "object"
            : String(v).slice(0, 80);
        hits.push({ path: p, preview });
      }
      walk(v, p, depth + 1);
    }
  }
  walk(pageProps, "pageProps", 0);
  if (hits.length) {
    console.log("Rent-related paths (sample):");
    for (const h of hits.slice(0, 25)) {
      console.log(`  ${h.path}: ${h.preview}`);
    }
  }

  return { parsed, raw };
}

async function main() {
  console.log("URL:", url);
  console.log(
    "Unlocker:",
    Boolean(process.env.BRIGHTDATA_API_KEY && process.env.BRIGHTDATA_UNLOCKER_ZONE),
  );

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-AU,en;q=0.9",
      },
      redirect: "follow",
    });
    const html = await res.text();
    inspect(html, `static_fetch HTTP ${res.status}`);
  } catch (e) {
    console.log("static_fetch error:", e.message);
  }

  try {
    const { fetchBrightDataHtml } = await import("../lib/brightdata/client.ts");
    const html = await fetchBrightDataHtml(url);
    const result = inspect(html ?? "", "brightdata_unlocker");
    if (html && html.length > 5000) {
      mkdirSync(resolve(ROOT, "tmp"), { recursive: true });
      const out = resolve(ROOT, "tmp/domain-property-profile-sample.html");
      writeFileSync(out, html);
      console.log("Saved HTML:", out);
    }
    if (result?.raw) {
      const jsonOut = resolve(ROOT, "tmp/domain-property-profile-next-data.json");
      writeFileSync(jsonOut, result.raw);
      console.log("Saved __NEXT_DATA__:", jsonOut);
    }
  } catch (e) {
    console.log("unlocker error:", e.message);
  }

  try {
    const { extractListingFromUrl } = await import("../lib/scraping/extractListing.ts");
    const { domainHtmlHasListingPayload } = await import(
      "../lib/scraping/parsers/domain.ts"
    );
    const r = await extractListingFromUrl(url);
    console.log("\n=== extractListingFromUrl ===");
    console.log({
      parser: r.parserName,
      method: r.method,
      address: r.listing.address,
      displayPrice: r.listing.displayPrice,
      purpose: r.listing.purpose,
      bedrooms: r.listing.bedrooms,
      rentalAppraisal: r.listing.rentalAppraisal,
      imageCount: r.listing.images?.length,
      warnings: r.listing.warnings,
    });
    if (r.html) {
      console.log("hasListingPayload:", domainHtmlHasListingPayload(r.html));
    }
  } catch (e) {
    console.log("extractListing error:", e.message);
  }
}

main();
