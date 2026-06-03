import * as cheerio from "cheerio";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";

const PORTAL_LISTING_HOSTS = [
  /^([a-z0-9-]+\.)*domain\.com\.au$/i,
  /^([a-z0-9-]+\.)*realestate\.com\.au$/i,
  /^([a-z0-9-]+\.)*realestateview\.com\.au$/i,
  /^([a-z0-9-]+\.)*view\.com\.au$/i,
  /^([a-z0-9-]+\.)*raywhite\.com$/i,
  /^([a-z0-9-]+\.)*harcourts\.com$/i,
  /^([a-z0-9-]+\.)*mcgrath\.com\.au$/i,
  /^property\.com\.au$/i,
];

const INDEX_PATH_SUFFIX =
  /\/(for-sale|sold|listings|buy|rent|search|results)\/?$/i;

function isSameHostListingDetail(resolved: URL, base: URL) {
  if (resolved.hostname.replace(/^www\./i, "") !== base.hostname.replace(/^www\./i, "")) {
    return false;
  }

  const path = resolved.pathname;
  if (INDEX_PATH_SUFFIX.test(path)) {
    return false;
  }

  return /\/(property|listing|rent|buy)\/[^/]+/i.test(path);
}

function isPortalListingUrl(resolved: URL) {
  const host = resolved.hostname.replace(/^www\./i, "").toLowerCase();
  return PORTAL_LISTING_HOSTS.some((re) => re.test(host));
}

function isListingHref(href: string, base: URL) {
  try {
    const resolved = new URL(href, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return false;
    }

    if (isPortalListingUrl(resolved)) {
      return true;
    }

    if (isSameHostListingDetail(resolved, base)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Extract listing detail URLs from a partner search/index page. */
export async function discoverListingUrlsFromPartnerPage(
  partnerPageUrl: string,
): Promise<string[]> {
  const html = await fetchStaticHtml(partnerPageUrl);
  const base = new URL(partnerPageUrl);
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (!isListingHref(href, base)) return;
    try {
      const resolved = new URL(href, base).toString().split("#")[0]!;
      urls.add(resolved);
    } catch {
      // ignore
    }
  });

  return [...urls];
}
