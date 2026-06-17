import * as cheerio from "cheerio";

const testUrl =
  "https://www.domain.com.au/304-49-beach-street-port-melbourne-vic-3207-2020851456";

// --- slug parsing (mirrors parseAddressFromUrl.ts) ---
const AU_STATES = new Set(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);
const STREET_TYPE_TOKENS = new Set([
  "road", "rd", "street", "st", "avenue", "ave", "drive", "dr", "court", "ct",
  "place", "pl", "lane", "ln", "way", "crescent", "cres", "parade", "pde",
  "esplanade", "esp", "boulevard", "blvd", "terrace", "tce", "circuit", "cct",
  "close", "cl", "grove", "gr", "highway", "hwy",
]);

function titleCaseWords(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseDomainListingSlug(slug) {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length < 5) return null;

  let endIndex = parts.length;
  if (/^\d{7,}$/.test(parts[endIndex - 1] ?? "")) endIndex -= 1;

  const postcode = parts[endIndex - 1];
  const state = parts[endIndex - 2]?.toUpperCase();
  if (!/^\d{4}$/.test(postcode) || !AU_STATES.has(state)) return null;

  const remainder = parts.slice(0, endIndex - 2);
  if (remainder.length < 2) return null;

  let streetNumberParts = 1;
  if (
    /^\d+$/.test(remainder[0] ?? "") &&
    /^\d+$/.test(remainder[1] ?? "") &&
    remainder.length >= 3
  ) {
    streetNumberParts = 2;
  } else if (!/^\d+[a-z]?$/i.test(remainder[0] ?? "")) {
    return null;
  }

  const afterNumber = remainder.slice(streetNumberParts);
  if (!afterNumber.length) return null;

  let streetEndInAfter = afterNumber.length;
  for (let i = 0; i < afterNumber.length; i++) {
    if (STREET_TYPE_TOKENS.has(afterNumber[i].toLowerCase())) {
      streetEndInAfter = i + 1;
      break;
    }
  }

  if (streetEndInAfter === afterNumber.length && afterNumber.length >= 3) {
    streetEndInAfter = afterNumber.length - 2;
  } else if (streetEndInAfter === afterNumber.length && afterNumber.length === 2) {
    streetEndInAfter = 1;
  }

  const streetNameTokens = afterNumber.slice(0, streetEndInAfter);
  const suburbTokens = afterNumber.slice(streetEndInAfter);
  if (!streetNameTokens.length || !suburbTokens.length) return null;

  const streetNumber =
    streetNumberParts === 2
      ? `${remainder[0]}/${remainder[1]}`
      : (remainder[0] ?? "");
  const street = `${streetNumber} ${titleCaseWords(streetNameTokens.join(" "))}`;
  const suburb = titleCaseWords(suburbTokens.join(" "));

  return { address: `${street}, ${suburb}`, suburb, state, postcode, street };
}

function extractDomainListingSlug(url) {
  const segment = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  if (!segment || !/\d-.*-[a-z]{2,3}-\d{4}/i.test(segment)) return null;
  return segment;
}

function domainHtmlHasListingPayload(html) {
  const nextData = cheerio.load(html)("#__NEXT_DATA__").text();
  if (!nextData) return false;
  try {
    const componentProps = JSON.parse(nextData)?.props?.pageProps?.componentProps;
    return Boolean(
      componentProps &&
        (typeof componentProps.address === "string" ||
          typeof componentProps.headline === "string"),
    );
  } catch {
    return false;
  }
}

const slug = extractDomainListingSlug(testUrl);
console.log("slug:", slug);
console.log("parsed slug:", parseDomainListingSlug(slug));

const apiKey = process.env.BROWSERLESS_API_KEY;
if (apiKey) {
  const res = await fetch(
    `https://production-sfo.browserless.io/smart-scrape?token=${apiKey}&timeout=60000`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: testUrl, formats: ["html"] }),
    },
  );
  const raw = await res.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.log("smart-scrape non-json:", raw.slice(0, 200));
    process.exit(1);
  }

  const html = payload.content ?? "";
  console.log("smart-scrape:", {
    ok: payload.ok,
    strategy: payload.strategy,
    htmlLen: html.length,
    hasPayload: domainHtmlHasListingPayload(html),
  });

  if (html.includes("__NEXT_DATA__")) {
    const cp = JSON.parse(cheerio.load(html)("#__NEXT_DATA__").text())?.props
      ?.pageProps?.componentProps;
    console.log("listing fields:", {
      address: cp?.address,
      headline: cp?.headline,
      images: cp?.gallery?.photos?.length,
      descriptionParas: Array.isArray(cp?.description) ? cp.description.length : typeof cp?.description,
    });
  }
}
