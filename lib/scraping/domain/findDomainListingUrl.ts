import * as cheerio from "cheerio";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import {
  type AddressMatchInput,
  domainListingMatchesAddress,
  parseStreetAddress,
  slugifySuburbSegment,
} from "@/lib/scraping/domain/addressMatch";

type DomainSearchListing = {
  url: string;
  address?: {
    street?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
  };
};

function buildSuburbSearchBase(input: AddressMatchInput) {
  const parsed = parseStreetAddress(input);
  if (!parsed.suburb || !parsed.state || !parsed.postcode) {
    return null;
  }

  const suburbSlug = slugifySuburbSegment(parsed.suburb);
  return `https://www.domain.com.au/sale/${suburbSlug}-${parsed.state.toLowerCase()}-${parsed.postcode}`;
}

function buildSearchUrls(input: AddressMatchInput) {
  const base = buildSuburbSearchBase(input);
  if (!base) {
    return [];
  }

  const parsed = parseStreetAddress(input);
  const urls = new Set<string>();
  const streetLine = input.address?.split(",")[0]?.trim();
  const suburbLabel = parsed.suburb?.replace(/-/g, " ");

  if (streetLine) {
    urls.add(`${base}/house/?keywords=${encodeURIComponent(streetLine)}`);
  }

  const keywordParts = [
    parsed.streetNumber,
    parsed.streetName,
    suburbLabel,
  ].filter(Boolean);

  if (keywordParts.length) {
    const keywords = keywordParts.join(" ");
    urls.add(`${base}/house/?keywords=${encodeURIComponent(keywords)}`);
  }

  if (parsed.streetNumber && parsed.streetName) {
    const streetNameQuery = parsed.streetName.split(" ")[0] ?? parsed.streetName;
    urls.add(
      `${base}/?streetnumber=${encodeURIComponent(parsed.streetNumber)}&streetname=${encodeURIComponent(streetNameQuery)}`,
    );
  }

  return [...urls];
}

function extractListingsFromSearchHtml(html: string): DomainSearchListing[] {
  const $ = cheerio.load(html);
  const nextData = $("#__NEXT_DATA__").text();
  if (!nextData) {
    return [];
  }

  try {
    const parsed = JSON.parse(nextData) as {
      props?: {
        pageProps?: {
          componentProps?: {
            listingsMap?: Record<
              string,
              {
                listingModel?: {
                  url?: string;
                  address?: DomainSearchListing["address"];
                };
              }
            >;
          };
        };
      };
    };

    const listingsMap = parsed.props?.pageProps?.componentProps?.listingsMap;
    if (!listingsMap) {
      return [];
    }

    return Object.values(listingsMap)
      .map((entry) => {
        const model = entry?.listingModel;
        if (!model?.url) {
          return null;
        }

        return {
          url: model.url.startsWith("http")
            ? model.url
            : `https://www.domain.com.au${model.url}`,
          address: model.address,
        };
      })
      .filter((entry): entry is DomainSearchListing => Boolean(entry));
  } catch {
    return [];
  }
}

export async function findDomainListingUrl(
  input: AddressMatchInput,
): Promise<string | null> {
  const target = parseStreetAddress(input);
  if (!target.suburb || !target.state || !target.postcode) {
    return null;
  }

  const searchUrls = buildSearchUrls(input);

  for (const searchUrl of searchUrls) {
    let html = "";
    try {
      html = await fetchStaticHtml(searchUrl);
    } catch {
      continue;
    }

    const listings = extractListingsFromSearchHtml(html);
    const match = listings.find(
      (listing) =>
        listing.address && domainListingMatchesAddress(listing.address, target),
    );

    if (match?.url) {
      return match.url;
    }
  }

  return null;
}
