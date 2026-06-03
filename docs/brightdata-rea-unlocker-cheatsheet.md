# Bright Data Cheatsheet (REA + Unlocker)

This is the project-specific reference for the Bright Data paths currently used in StayPacks.

## What this app uses today

- **REA Dataset scrape** for listing details, images, and agents.
- **REA Dataset discover** (`type=discover_new&discover_by=url`) for rent comps + weekly band (investor lease appraisal). Long jobs return a `snapshot_id`; the client polls progress and downloads the snapshot when ready.
- **Web Unlocker request** for REA search-result HTML discovery.
- **Domain helper flow** that can use Bright Data unlocker when configured.

Code entrypoints:

- `lib/brightdata/client.ts`
- `lib/scraping/reaEnrichment.ts`
- `lib/scraping/rea/findReaListingUrl.ts`
- `lib/scraping/extractListing.ts`

## Required env vars

Add these to `.env.local` (and mirror in `.env.example` if needed):

```bash
BRIGHTDATA_API_KEY=...
BRIGHTDATA_REA_DATASET_ID=gd_l3cvjh111l943r4awk
BRIGHTDATA_UNLOCKER_ZONE=...
```

Optional timeout tuning:

```bash
BRIGHTDATA_SCRAPE_TIMEOUT_MS=25000
BRIGHTDATA_REA_SCRAPE_TIMEOUT_MS=60000
BRIGHTDATA_REA_DISCOVER_TIMEOUT_MS=180000
```

See also: [rental-appraisal-pipeline.md](./rental-appraisal-pipeline.md)

Notes:

- `BRIGHTDATA_API_KEY` is required for both REA dataset and unlocker calls.
- If `BRIGHTDATA_REA_DATASET_ID` is missing, code falls back to `gd_l3cvjh111l943r4awk`.
- If `BRIGHTDATA_UNLOCKER_ZONE` is missing, REA search discovery via unlocker is disabled.

## REA flow used by this codebase

1. Try to resolve a REA property URL:
   - Directly from source URL if it is `realestate.com.au/property-*`.
   - Otherwise **Google AU SERP** (`site:realestate.com.au` + address) via Web Unlocker — primary for partner/agency URLs without postcode.
   - Fallback: REA buy/rent search pages (needs suburb + state + postcode).
2. If REA URL found, call Bright Data dataset scrape endpoint:
   - `POST /datasets/v3/scrape?dataset_id=...&notify=false&include_errors=true`
   - body: `{ "input": [{ "url": "<rea property url>" }] }`
3. Parse record into internal `ParsedListing` shape (address, bedrooms, images, agents, etc.).
4. Merge with any source address hint and emit warnings.

Implemented in:

- `tryReaBrightDataImport()` in `lib/scraping/reaEnrichment.ts`
- `findReaListingUrlViaGoogle()` in `lib/scraping/rea/findReaListingUrlViaGoogle.ts`
- `findReaListingUrlOnReaSite()` in `lib/scraping/rea/findReaListingUrlOnReaSite.ts`
- `scrapeBrightDataReaListing()` in `lib/brightdata/client.ts`

## Unlocker flow used by this codebase

Unlocker is used as raw HTML fetch in two places:

- REA search discovery in `findReaListingUrl()`:
  - calls `fetchBrightDataHtml()` against REA search pages.
  - extracts `/property-...` URLs from HTML and scores best match.
- Domain listing import path in `extractListingFromUrl()`:
  - when `hasBrightDataUnlockerConfig()` is true, method is tracked as `brightdata_unlocker` for Domain-assisted flows.

Request used by unlocker helper:

- `POST /request`
- body:
  - `zone: BRIGHTDATA_UNLOCKER_ZONE`
  - `url: <target url>`
  - `format: "raw"`

Implemented in:

- `fetchBrightDataHtml()` in `lib/brightdata/client.ts`

## Fallback order (high level)

`extractListingFromUrl()` currently prefers:

1. Direct Domain listing handling for Domain URLs.
2. URL-address seed + Domain primary assist (unlocker-aware when configured).
3. REA Bright Data import (if REA config exists).
4. Agency HTML parse (rendered/static), Domain fallback, optional OpenAI enrichment.

This means Bright Data can contribute via:

- `brightdata_rea` method
- `brightdata_unlocker` method

## Quick debug checklist

- Verify keys/zones:
  - `BRIGHTDATA_API_KEY`
  - `BRIGHTDATA_REA_DATASET_ID`
  - `BRIGHTDATA_UNLOCKER_ZONE`
- Check API errors in warnings returned by `/api/listings/scrape`.
- If REA import is not used:
  - confirm address hint has suburb/state/postcode.
  - confirm unlocker zone is set (for REA search discovery).
- If dataset returns empty:
  - validate the resolved REA URL is a property URL.
  - test with increased `BRIGHTDATA_REA_SCRAPE_TIMEOUT_MS`.

## Minimal parity snippets (current approach)

REA dataset scrape pattern:

```ts
const raw = await brightDataRequest(
  `/datasets/v3/scrape?dataset_id=${encodeURIComponent(datasetId)}&notify=false&include_errors=true`,
  { input: [{ url: reaUrl }] },
  { timeoutMs: getReaScrapeTimeoutMs() },
);
```

Unlocker raw request pattern:

```ts
const rawHtml = await brightDataRequest(
  "/request",
  { zone, url, format: "raw" },
  { timeoutMs: getScrapeTimeoutMs() },
);
```
