/**
 * Probe Surfers Paradise FN search page with multiple fetch/discovery methods.
 * Usage: node scripts/probe-spfn-discovery.mjs
 */
import * as cheerio from "cheerio";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SEARCH_URL =
  "https://surfersparadisefn.com.au/real-estate-search/residential-real-estate?ltype=1&page=1&sort=date-desc";

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

async function fetchStaticHtml(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

const LISTING_PATH_PATTERNS = [
  /domain\.com\.au\//i,
  /realestate\.com\.au\//i,
  /realestateview\.com\.au\//i,
  /view\.com\.au\//i,
  /raywhite\.com\//i,
  /harcourts\.com\//i,
  /mcgrath\.com\.au\//i,
  /property\.com\.au\//i,
];

function isGenericListingHref(href, base) {
  try {
    const resolved = new URL(href, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return false;
    }
    const full = resolved.toString();
    if (LISTING_PATH_PATTERNS.some((re) => re.test(full))) return true;
    if (
      resolved.hostname === base.hostname &&
      /\/(property|listing|rent|buy)\//i.test(resolved.pathname)
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** SPFN site uses /real-estate/... detail paths */
function isSpfnDetailHref(href, base) {
  try {
    const resolved = new URL(href, base);
    if (resolved.hostname !== base.hostname) return false;
    return /\/real-estate\//i.test(resolved.pathname) &&
      !/\/real-estate-search\//i.test(resolved.pathname);
  } catch {
    return false;
  }
}

function discoverGeneric(html, baseUrl) {
  const base = new URL(baseUrl);
  const $ = cheerio.load(html);
  const urls = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !isGenericListingHref(href, base)) return;
    try {
      urls.add(new URL(href, base).toString().split("#")[0]);
    } catch {
      // ignore
    }
  });
  return [...urls];
}

function discoverSpfnDetail(html, baseUrl) {
  const base = new URL(baseUrl);
  const $ = cheerio.load(html);
  const urls = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !isSpfnDetailHref(href, base)) return;
    try {
      urls.add(new URL(href, base).toString().split("#")[0]);
    } catch {
      // ignore
    }
  });
  return [...urls];
}

function extractSpfnCards(html, baseUrl) {
  const $ = cheerio.load(html);
  const cards = [];
  const seen = new Set();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, baseUrl).toString().split("#")[0];
      if (!isSpfnDetailHref(href, new URL(baseUrl))) return;
      if (seen.has(url)) return;
      seen.add(url);

      const anchor = $(el);
      const container =
        anchor.closest("article, .property, .listing, .card, li, [class*='property']").first() ||
        anchor.parent();
      const text = container.text().replace(/\s+/g, " ").trim();
      const title =
        anchor.find("h2,h3,h4").first().text().trim() ||
        anchor.text().replace(/\s+/g, " ").trim().slice(0, 120);

      cards.push({ url, title: title.slice(0, 200), snippet: text.slice(0, 300) });
    } catch {
      // ignore
    }
  });

  return cards;
}

async function tryBrightDataUnlocker(url) {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const zone = process.env.BRIGHTDATA_UNLOCKER_ZONE;
  if (!apiKey || !zone) {
    return { ok: false, reason: "missing BRIGHTDATA_API_KEY or BRIGHTDATA_UNLOCKER_ZONE" };
  }

  const response = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zone, url, format: "raw" }),
  });

  if (!response.ok) {
    return { ok: false, reason: `unlocker HTTP ${response.status}` };
  }

  const html = await response.text();
  return { ok: true, html, length: html.length };
}

async function tryBrowserless(url) {
  const token = process.env.BROWSERLESS_API_KEY;
  if (!token) {
    return { ok: false, reason: "missing BROWSERLESS_API_KEY" };
  }

  const endpoint = `https://production-sfo.browserless.io/chromium/bql?token=${token}`;
  const query = `
    mutation Scrape($url: String!) {
      goto(url: $url, waitUntil: networkIdle) { status }
      html { html }
    }
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { url } }),
  });

  if (!response.ok) {
    return { ok: false, reason: `browserless HTTP ${response.status}` };
  }

  const json = await response.json();
  const html = json?.data?.html?.html;
  if (!html) {
    return { ok: false, reason: "no html in browserless response" };
  }
  return { ok: true, html, length: html.length };
}

async function probeOneDetail(url) {
  try {
    const html = await fetchStaticHtml(url, 15000);
    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ");
    const addressMatch =
      text.match(
        /\d+[^,]{0,80},\s*[A-Za-z\s]+\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4}/i,
      )?.[0] ?? null;
    const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
    const h1 = $("h1").first().text().trim();
    return { url, ok: true, h1: h1.slice(0, 120), ogTitle, addressGuess: addressMatch };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("SPFN discovery probe\n", SEARCH_URL, "\n");

  const methods = [];

  // 1) Static fetch
  try {
    const html = await fetchStaticHtml(SEARCH_URL);
    const generic = discoverGeneric(html, SEARCH_URL);
    const spfn = discoverSpfnDetail(html, SEARCH_URL);
    const cards = extractSpfnCards(html, SEARCH_URL);
    methods.push({
      method: "static_fetch",
      ok: true,
      htmlLength: html.length,
      genericLinks: generic.length,
      spfnDetailLinks: spfn.length,
      sampleSpfn: spfn.slice(0, 5),
      cards: cards.slice(0, 5),
    });
  } catch (error) {
    methods.push({
      method: "static_fetch",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 2) Bright Data unlocker
  const unlocker = await tryBrightDataUnlocker(SEARCH_URL);
  if (unlocker.ok) {
    const generic = discoverGeneric(unlocker.html, SEARCH_URL);
    const spfn = discoverSpfnDetail(unlocker.html, SEARCH_URL);
    methods.push({
      method: "brightdata_unlocker",
      ok: true,
      htmlLength: unlocker.length,
      genericLinks: generic.length,
      spfnDetailLinks: spfn.length,
      sampleSpfn: spfn.slice(0, 5),
    });
  } else {
    methods.push({ method: "brightdata_unlocker", ok: false, reason: unlocker.reason });
  }

  // 3) Browserless
  const browserless = await tryBrowserless(SEARCH_URL);
  if (browserless.ok) {
    const generic = discoverGeneric(browserless.html, SEARCH_URL);
    const spfn = discoverSpfnDetail(browserless.html, SEARCH_URL);
    methods.push({
      method: "browserless_rendered",
      ok: true,
      htmlLength: browserless.length,
      genericLinks: generic.length,
      spfnDetailLinks: spfn.length,
      sampleSpfn: spfn.slice(0, 5),
    });
  } else {
    methods.push({
      method: "browserless_rendered",
      ok: false,
      reason: browserless.reason,
    });
  }

  console.log(JSON.stringify({ searchUrl: SEARCH_URL, methods }, null, 2));

  const best = methods
    .filter((m) => m.ok && m.spfnDetailLinks > 0)
    .sort((a, b) => b.spfnDetailLinks - a.spfnDetailLinks)[0];

  if (!best) {
    console.log("\nNo method found SPFN detail links. Check HTML manually.");
    return;
  }

  console.log("\nBest discovery:", best.method, "→", best.spfnDetailLinks, "detail URLs");
  const detailUrl = best.sampleSpfn?.[0];
  if (detailUrl) {
    console.log("\nProbing first detail page:", detailUrl);
    console.log(JSON.stringify(await probeOneDetail(detailUrl), null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
