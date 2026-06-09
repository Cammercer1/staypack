# Rental appraisal pipeline (REA → investor lease appraisal)

## Overview

This pipeline powers **investor-facing lease appraisals** (“what can I lease this for?”), not tenant **lease brochures** in collateral.

1. **Property details** — REA listing URL via Apify (`tryReaApifyImport`, preferred) or Bright Data dataset fallback (`tryReaImport` in `extractListingFromUrl`).
2. **Rent band + comps** — REA rent SERP via Apify (`memo23/realestate-au-listings`, preferred) or Bright Data `discover_new` fallback (`enrichListingRentalAppraisal`).
3. **Suburb context** — PropRadar `GET /v1/suburbs/{state}/{suburb}?postcode=` (`enrichLtrSuburbMarket`): vacancy, population, renters %, gross yield for house vs unit segment.
3. **Report PDF** — `buildLeaseAppraisalReport` → `haven-properties-lease-appraisal` template (Landmark-inspired layout under `lib/reports/templates/haven-properties/`). Managed delivery: `generateHeadlessLeaseAppraisal`.

Collateral `rental_brochure` templates are unchanged.

**Page 1 copy:** Shared AI contract in `lib/copy/pageOneMarketingCopy.ts` — `heading`, single-paragraph `blurb` (max 350 chars), exactly four `bullets`. Lease page 2 comparable narrative is template-derived (`deriveComparableEvidence`), not part of that JSON. OpenAI when `OPENAI_API_KEY` is set (`generateLeaseAppraisalCopy`); otherwise `deriveLeaseAppraisalCopy`.

## Env

```bash
BRIGHTDATA_API_KEY=...
BRIGHTDATA_REA_DATASET_ID=gd_l3cvjh111l943r4awk
# Single-property REA scrape (default 60s)
BRIGHTDATA_REA_SCRAPE_TIMEOUT_MS=60000
# Rent discover SERP crawl (default 180s) — Bright Data fallback
BRIGHTDATA_REA_DISCOVER_TIMEOUT_MS=180000

# Apify — REA rent comps (preferred when set)
APIFY_API_KEY=
APIFY_REA_ACTOR_ID=qBUaDtdr6kYSBZE8J
APIFY_REA_MAX_LISTINGS=50
APIFY_REA_TIMEOUT_MS=120000

# PropRadar suburb medians / vacancy / yield (lease appraisal suburb context)
PROP_RADAR_API_KEY=
```

## API

`POST /api/listings/rental-appraisal` (max duration 300s)

```json
{ "listingId": "<uuid>" }
```

or

```json
{ "url": "https://surfersparadisefn.com.au/buy-residential-real-estate/..." }
```

Returns `rentalAppraisal`, `rentalComps`, `displayPrice`, and persists to `listings` when using `listingId`.

## Scrape with rent enrichment

```ts
await extractListingFromUrl(url, { enrichRentalAppraisal: true });
```

## CLI

```bash
npx tsx scripts/enrich-rental-appraisal.mjs "<agency listing url>"

# Test band math from a saved Bright Data JSON export:
npx tsx scripts/enrich-rental-appraisal.mjs --from-json ~/Downloads/sd_mpuu1la37xa3f8twa.json

# Build / refresh lease appraisal fixture (property URL + rent SERP):
npx tsx scripts/build-lease-appraisal-fixture.mjs \
  "https://www.realestate.com.au/property/unit-1401-67-ferny-ave-surfers-paradise-qld-4217/" \
  --rent-search-url "https://www.realestate.com.au/rent/property-unit+apartment-with-2-bedrooms-in-surfers+paradise,+qld+4217/list-1?numParkingSpaces=1&numBaths=2&maxBeds=2&activeSort=list-date&source=refinement"

# Or merge a saved Bright Data discover export (skip live discover):
npx tsx scripts/build-lease-appraisal-fixture.mjs "<property-url>" \
  --discover-json ~/Downloads/sd_mpuu1la37xa3f8twa.json \
  --rent-search-url "<rea-rent-serp-url>"
```

## Template dev preview

Open **`/dev/haven-properties/lease-appraisal`** (fixture: `lib/lease-appraisal/fixtures/haven-hamilton-lease-appraisal.json`).

## REA discover URL shape

Discovery runs **progressive** typed SERPs via `buildRentDiscoverAttempts` (stops early when enough same-suburb, type-matched comps exist):

1. `property-{house|unit+apartment|townhouse}-with-{n}-bedrooms-in-{suburb}` + `numBaths`, `numParkingSpaces`, `maxBeds`, `source=refinement`
2. Drop parking, then baths, then try `n-1` beds (same property type — never mix units with houses)
3. Optional luxury `keywords` on the subject suburb; then typed neighbor suburbs from `nearbyRentSearchSuburbs`

Example (3 bed house, Randwick):

`https://www.realestate.com.au/rent/property-house-with-3-bedrooms-in-randwick,+nsw+2031/list-1?maxBeds=3&activeSort=list-date&source=refinement&numBaths=2&numParkingSpaces=1`

## Rent band logic

- Build REA rent SERP from suburb, state, postcode, beds (surrounding suburbs included by REA).
- Apify actor returns up to `APIFY_REA_MAX_LISTINGS` (default 50) per search; free Apify tier caps at 5/run.
- Parse listings with `channel: rent` and weekly price; filter by property-type family in band math.
- Drop outer 10% outliers; **median** = midpoint; **p25/p75** = min/max band.
- Pick 6 featured comps (default selection ranked for subject; page 2 is a 2×3 grid).

## Code map

| File | Role |
|------|------|
| `lib/apify/client.ts` | Apify REA actor (listing import + rent search) |
| `lib/scraping/rea/parseApifyRea.ts` | Apify record → `ParsedListing` |
| `lib/rental/parseApifyReaListings.ts` | Apify record → rent comp |
| `lib/brightdata/client.ts` | `scrapeBrightDataReaRentDiscover` (fallback) |
| `lib/rental/buildReaRentSearchUrl.ts` | SERP URL builder |
| `lib/rental/parseReaRentDiscover.ts` | Record → comp |
| `lib/rental/computeRentBand.ts` | Median / band / format |
| `lib/rental/enrichListingRentalAppraisal.ts` | REA discover + PropRadar suburb orchestrator |
| `lib/propradar/client.ts` | Suburb statistics API |
| `lib/propradar/enrichLtrSuburbMarket.ts` | Attach `ltrSuburbMarket` to parsed listing |
| `lib/lease-appraisal/buildLeaseAppraisalReport.ts` | `FinalReportJson` + `ltr_enrichment` |
| `lib/reports/templates/haven-properties/HavenPropertiesLeaseAppraisalTemplate.tsx` | 2-page investor PDF layout |
| `lib/delivery/lease/generateHeadlessLeaseAppraisal.ts` | Managed delivery PDF |
