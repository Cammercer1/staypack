import { fetchStaticHtml } from "../lib/scraping/fetchStaticHtml.ts";
import * as cheerio from "cheerio";

const url =
  "https://surfersparadisefn.com.au/buy-residential-real-estate/apartment-1401-67-ferny-avenue-surfers-paradise-qld-11028103559";

const html = await fetchStaticHtml(url);
const $ = cheerio.load(html);

console.log("h1:", $("h1").first().text().trim());
console.log("title:", $("title").text().trim());

const jsonLd = [];
$('script[type="application/ld+json"]').each((_, el) => {
  try {
    jsonLd.push(JSON.parse($(el).html() ?? "{}"));
  } catch {
    // skip
  }
});
console.log("jsonLd count", jsonLd.length);
for (const block of jsonLd.slice(0, 3)) {
  console.log(JSON.stringify(block, null, 2).slice(0, 800));
}

const body = $("body").text().replace(/\s+/g, " ");
const patterns = [
  /\d+[^,]{0,80},\s*[A-Za-z\s]+\s+QLD\s+\d{4}/gi,
  /Surfers Paradise[^]{0,40}QLD\s+\d{4}/gi,
  /4217/g,
];
for (const re of patterns) {
  const m = body.match(re);
  if (m) console.log(re.source, m.slice(0, 3));
}

// meta
console.log("og:title", $('meta[property="og:title"]').attr("content"));
console.log(
  "description",
  $('meta[name="description"]').attr("content")?.slice(0, 200),
);
