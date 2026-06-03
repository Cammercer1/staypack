import * as cheerio from "cheerio";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { isSpfnHostname } from "@/lib/scraping/spfn/parseSpfnListing";
import type {
  DiscoveredListing,
  PartnerDiscoveryAdapter,
  PartnerSourceInput,
} from "@/lib/delivery/scrape/adapters/types";

const DEFAULT_MAX_PAGES = 3;

function isSpfnBuyResidentialPath(pathname: string) {
  return /\/buy-residential-real-estate\/[^/]+\/?$/i.test(pathname);
}

function discoverFromHtml(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, base);
      if (!isSpfnHostname(resolved.hostname)) return;
      if (!isSpfnBuyResidentialPath(resolved.pathname)) return;
      urls.add(resolved.toString().split("#")[0]!);
    } catch {
      // ignore
    }
  });

  return [...urls];
}

function pageUrlWithNumber(baseUrl: string, page: number) {
  const url = new URL(baseUrl);
  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

/**
 * First National Surfers Paradise (surfersparadisefn.com.au).
 * Probed 2026-06: static_fetch on search pages yields /buy-residential-real-estate/{slug} links.
 */
export const spfnFirstNationalAdapter: PartnerDiscoveryAdapter = {
  id: "spfn_first_national_v1",

  async discover(source: PartnerSourceInput): Promise<DiscoveredListing[]> {
    const maxPages =
      typeof source.config?.maxPages === "number" && source.config.maxPages > 0
        ? Math.min(source.config.maxPages, 10)
        : DEFAULT_MAX_PAGES;

    const fetchMethod =
      source.config?.fetchMethod === "browserless_rendered"
        ? "browserless_rendered"
        : "static_fetch";

    if (fetchMethod !== "static_fetch") {
      throw new Error(
        "spfn_first_national_v1 only supports static_fetch (probed best method for this site)",
      );
    }

    const allUrls = new Set<string>();

    for (let page = 1; page <= maxPages; page += 1) {
      const pageUrl = pageUrlWithNumber(source.url, page);
      const html = await fetchStaticHtml(pageUrl);
      for (const url of discoverFromHtml(html, pageUrl)) {
        allUrls.add(url);
      }
    }

    const maxListings =
      typeof source.config?.max_listings === "number" && source.config.max_listings > 0
        ? Math.min(source.config.max_listings, 50)
        : typeof source.config?.maxListings === "number" && source.config.maxListings > 0
          ? Math.min(source.config.maxListings, 50)
          : null;

    const urls = [...allUrls];
    const capped = maxListings != null ? urls.slice(0, maxListings) : urls;

    return capped.map((listingUrl) => ({
      listingUrl,
      discoveryMethod: "spfn_first_national_v1:static_fetch",
    }));
  },
};
