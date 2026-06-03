# Rental appraisal pipeline (REA → investor lease appraisal)

## Overview

This pipeline powers **investor-facing lease appraisals** (“what can I lease this for?”), not tenant **lease brochures** in collateral.

1. **Property details** — Bright Data REA dataset scrape on the listing URL (`tryReaBrightDataImport` in `extractListingFromUrl`).
2. **Rent band + comps** — REA rent SERP via dataset `discover_new` (`enrichListingRentalAppraisal`).
3. **Suburb context** — PropRadar `GET /v1/suburbs/{state}/{suburb}?postcode=` (`enrichLtrSuburbMarket`): vacancy, population, renters %, gross yield for house vs unit segment.
3. **Report PDF** — `buildLeaseAppraisalReport` → `haven-properties-lease-appraisal` template (Landmark-inspired layout under `lib/reports/templates/haven-properties/`). Managed delivery: `generateHeadlessLeaseAppraisal`.

Collateral `rental_brochure` templates are unchanged.

**Page 1 copy:** Teal bar = document type (“Long-term rental appraisal”). Body **heading** comes from the REA listing (title / description lead-in) via `deriveLeaseAppraisalCopy`, or OpenAI when `OPENAI_API_KEY` is set (`generateLeaseAppraisalCopy`).

## Env

```bash
BRIGHTDATA_API_KEY=...
BRIGHTDATA_REA_DATASET_ID=gd_l3cvjh111l943r4awk
# Single-property REA scrape (default 60s)
BRIGHTDATA_REA_SCRAPE_TIMEOUT_MS=60000
# Rent discover SERP crawl (default 180s)
BRIGHTDATA_REA_DISCOVER_TIMEOUT_MS=180000

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

Pipeline builds URLs **without** `keywords` / `checkedFeatures` (those shrink and skew comps):

`https://www.realestate.com.au/rent/property-unit+apartment-with-3-bedrooms-in-surfers+paradise,+qld+4217/list-1?maxBeds=3&activeSort=list-date&source=refinement&numBaths=2&numParkingSpaces=1`

Optional amenity filters are available via `featureKeywords` on `buildReaRentSearchUrl` but discouraged.

## Rent band logic

- Build REA rent SERP from suburb, state, postcode, beds, baths, parking, property type.
- Parse discover records with `listing_type: Rent` and `rent_price`.
- Filter by property-type family; prefer same suburb when ≥5 matches.
- Drop outer 10% outliers; **median** = midpoint; **p25/p75** = min/max band.
- Pick 4 featured comps closest to median for report page 2.

## Code map

| File | Role |
|------|------|
| `lib/brightdata/client.ts` | `scrapeBrightDataReaRentDiscover` |
| `lib/rental/buildReaRentSearchUrl.ts` | SERP URL builder |
| `lib/rental/parseReaRentDiscover.ts` | Record → comp |
| `lib/rental/computeRentBand.ts` | Median / band / format |
| `lib/rental/enrichListingRentalAppraisal.ts` | REA discover + PropRadar suburb orchestrator |
| `lib/propradar/client.ts` | Suburb statistics API |
| `lib/propradar/enrichLtrSuburbMarket.ts` | Attach `ltrSuburbMarket` to parsed listing |
| `lib/lease-appraisal/buildLeaseAppraisalReport.ts` | `FinalReportJson` + `ltr_enrichment` |
| `lib/reports/templates/haven-properties/HavenPropertiesLeaseAppraisalTemplate.tsx` | 2-page investor PDF layout |
| `lib/delivery/lease/generateHeadlessLeaseAppraisal.ts` | Managed delivery PDF |
