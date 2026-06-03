import { writeFileSync } from "node:fs";
import { fetchStaticHtml } from "../lib/scraping/fetchStaticHtml.ts";

const url =
  "https://surfersparadisefn.com.au/real-estate-search/residential-real-estate?ltype=1&page=1&sort=date-desc";

const html = await fetchStaticHtml(url);
writeFileSync("tmp-spfn-static.html", html);

const hrefs = new Set();
for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
  hrefs.add(m[1]);
}

const interesting = [...hrefs].filter(
  (h) =>
    /real|property|listing|estate|rent|sale|detail|search/i.test(h) &&
    !h.startsWith("#") &&
    !h.startsWith("javascript"),
);

console.log("total hrefs", hrefs.size);
console.log("interesting hrefs", interesting.length);
interesting.slice(0, 50).forEach((h) => console.log(" ", h));

const paths = [
  ...new Set([...html.matchAll(/\/real-estate[a-z0-9\-\/]*/gi)].map((m) => m[0])),
].slice(0, 40);
console.log("\n/real-estate paths in HTML:", paths);

const addresses = [
  ...html.matchAll(
    /\d+[^,]{0,60},\s*[A-Za-z][A-Za-z\s]{2,40}\s+(QLD|NSW|VIC)\s+\d{4}/gi,
  ),
].map((m) => m[0]);
console.log("\naddress-like strings", addresses.length);
addresses.slice(0, 15).forEach((a) => console.log(" ", a));

if (html.includes("propertyList")) console.log("\nfound propertyList");
if (html.includes("listings")) console.log("found listings keyword");
const dataAttrs = [...html.matchAll(/data-[a-z-]+=["'][^"']{0,80}/gi)]
  .map((m) => m[0])
  .filter((s) => /property|listing|estate/i.test(s))
  .slice(0, 20);
console.log("\ndata attrs", dataAttrs);
