#!/usr/bin/env node
/**
 * Quick probe: can we fetch listing data without a browser?
 * Usage: node scripts/probe-listing-sources.mjs [listing-url]
 */
const DEFAULT_URL =
  "https://www.mcgrath.com.au/property/42-suttor-road-moss-vale-nsw-2577-59P7099";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function analyze(html) {
  return {
    len: html.length,
    checkpoint: /vercel security checkpoint|we're verifying your browser/i.test(
      html,
    ),
    kasada: /KPSDK|kpsdk/i.test(html),
    nextData: /<script id="__NEXT_DATA__"/i.test(html),
    jsonLd: /application\/ld\+json/i.test(html),
    suttor: /suttor/i.test(html),
    title: html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim() ?? null,
  };
}

async function probe(label, url) {
  try {
    const res = await fetch(url, { headers: UA, redirect: "follow" });
    const text = await res.text();
    console.log(
      JSON.stringify({ label, url, status: res.status, ...analyze(text) }, null, 0),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        label,
        url,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

const listingUrl = process.argv[2] ?? DEFAULT_URL;
const id = listingUrl.split("-").pop()?.replace(/\/.*/, "") ?? "";

const host = new URL(listingUrl).origin;

console.log(`Probing sources for:\n${listingUrl}\n`);

await probe("listing page", listingUrl);
await probe("robots.txt", `${host}/robots.txt`);
await probe("sitemap.xml", `${host}/sitemap.xml`);
await probe("_next/data json", `${host}/_next/data/build/property/x-${id}.json`);
await probe("api by id", `${host}/api/property/${id}`);
await probe("sitecore api", `${host}/sitecore/api/ssc/item`);
await probe("domain suburb search", "https://www.domain.com.au/sale/moss-vale-nsw-2577/?streetname=suttor");
await probe("realestate suburb", "https://www.realestate.com.au/buy/in-moss-vale,+nsw+2577/list-1");
