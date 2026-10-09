# STR API transition plan

Validated on 9 October 2026 against listing `9d6ee81d-63fc-4a5a-8dbf-001a771114d7`.

**Recommendation:** use the subscribed RapidAPI Rentalizer for the property estimate, then fetch details for the selected comparable properties. Keep search as an optional way to find additional comps. The core estimate and comp cards are viable; this subscription's observed responses do not yet replace Airbtics' property seasonality, percentile ranges, or StayPacks' existing positioning inputs. Introduce the new provider behind a switch and resolve these differences before making it the default.

## Live comparison

Subject: **14A/18–24 Aubrey Street, Surfers Paradise QLD 4217, Australia**. Both requests used **2 bedrooms, 2 bathrooms, 4 guests**. Rentalizer resolved exactly the stored coordinates, **-28.0115873, 153.4306796**, including the unit address.

| Metric | Fresh Airbtics full response | Existing StayPacks final report | RapidAPI Rentalizer |
| --- | ---: | ---: | ---: |
| Estimated annual gross STR revenue | $65,893 | $61,000 | $54,083 |
| Average monthly estimate | $5,491 | $5,083 | $4,507 |
| Average weekly estimate | $1,267 | $1,173 | $1,040 |
| ADR | $250 | $270 | $252 |
| Occupancy | 69% | 62% | 59% |
| Estimated booked nights | 252 | 226 | 215 |
| Returned comparable properties | 40 | 6 stored, 4 shown by Classic | 50 |
| Property monthly series | 12 months | Available | Null |
| Provider annual percentiles | p25 $43,934; p50 $65,893; p75 $76,867; p90 $81,906 | Available to positioning | Null |
| Confidence | No equivalent mapped score | Medium, from StayPacks positioning | Low, provider score 35.5 |
| Estimate request duration | 4.15 seconds including polling | Existing saved result | 3.35 seconds |

All money in this table is treated as AUD. Rentalizer supports `currency=native`; the Australian subject and explicit `currency: aud` in detail/search responses support this mapping. Its `$` symbol alone is insufficient currency validation for a general adapter.

The new estimate is **17.9% below raw Airbtics** and **11.3% below the current positioned report**. These differences do not establish which estimate is more accurate. They compare provider models and potentially different revenue definitions, not actual booking outcomes. Monthly and weekly figures above are arithmetic averages, not seasonal projections. Booked nights are derived assuming 365-day availability.

The Airbtics preview uses the saved report generated on 9 October with the $61,000 positioned result. A fresh API call confirmed the same $65,893 raw baseline; the positioning model was not rerun. The new preview uses $54,083 without a positioning adjustment. Matching report functionality does not mean forcing the new provider to reproduce $61,000.

## What was tested

The existing `RAPIDAPI_REA_KEY` in `.env.local` authenticated successfully to `airdna1.p.rapidapi.com`. No key was printed, copied into an artifact, or changed. Netlify credentials were unnecessary for this test and have not been checked.

| Operation | Actual result | Role in the new flow |
| --- | --- | --- |
| Airbtics `POST /report/all`, then report polling | Successful; 40 comps, percentiles and monthly series | Baseline and temporary rollback provider |
| RapidAPI `GET /rentalizer` | HTTP 200; estimate, 50 comps, confidence, market identifiers, comp-set amenity percentages | Required primary estimate |
| `GET /properties/details` for six selected IDs | All six ultimately succeeded; explicit AUD and keyed revenue, occupancy, ADR | Required to fill null Rentalizer comp metrics |
| `GET /properties` for Surfers Paradise, entire places, 2 beds and 2 baths | HTTP 200; 18 records, reported result count 1,325; performance metrics present | Optional comp discovery or a future batch optimization |
| `GET /market_metric`, submarket `137067`, monthly revenue, AUD | HTTP 200 containing `error.type: invalid_credentials` and an upstream unauthorized message | Not usable for this tested request; investigate provider access and accepted IDs |

Four rapid sequential detail requests returned 429. Retrying those requests with approximately 1.5 seconds between calls succeeded. This demonstrates the need for throttling; it does not establish a contractual rate limit. The final quota header showed **3,000 requests per period, 2,991 remaining**: nine successful HTTP responses consumed nine units during this exercise, including the market endpoint's application-level error. There were 13 RapidAPI attempts including the four 429 responses. Plan name, billing price and overage terms were not retrieved.

Provider endpoint documentation: [Rentalizer](https://rapidapi.com/s.mahmoud97/api/airdna1/playground/getRentalEstimate), [property details](https://rapidapi.com/s.mahmoud97/api/airdna1/playground/getPropertyDetails), [property search](https://rapidapi.com/s.mahmoud97/api/airdna1/playground/searchProperties), [market metric](https://rapidapi.com/s.mahmoud97/api/airdna1/playground/getMarketMetric).

### Seasonality follow-up

AirDNA's own Rentalizer supports monthly projections, and this RapidAPI endpoint explicitly advertises seasonality. The finding is **missing seasonality in the tested service responses**, not that AirDNA lacks it. The documented Rentalizer parameters are address, bedrooms, bathrooms, accommodates and currency; no seasonality toggle is documented. The published example response is only `data: {}`.

Two additional diagnostic calls on 9 October returned HTTP 200 with the same null `revenue_years`, `occupancy_years`, `adr_years` and `revenue_range`: the subject property using USD, and the provider's own example at 650 NE 32nd St, Miami, using its default 2-bed/2-bath/2-guest configuration. Both still returned a populated monthly cleaning-fee series. This makes an Australian-address-only or native-currency-only explanation unlikely. Upstream entitlement or the wrapper's response mapping are plausible causes, but the cause is unconfirmed. Resolve this advertised-capability mismatch with the provider before accepting loss of seasonality as the final product design.

Diagnostic captures: `seasonality-check-subject-usd.json` and `seasonality-check-provider-example-native.json` in the artifact directory. These two extra calls brought the observed remaining quota to 2,989.

## Endpoint strategy

### Default report

1. Read the current listing and explicit user inputs. Preserve unit address, bedrooms, bathrooms and accommodates; do not silently substitute the API playground defaults.
2. Request `/rentalizer` with the full address and `currency=native` from the server.
3. Verify resolved country/location and returned configuration before accepting the estimate. Record the provider confidence separately from any StayPacks review confidence.
4. Filter the returned comps to entire homes and relevant property configurations, deduplicate by stable property ID, and prioritize proximity and property similarity. Then choose up to six for the report.
5. Read `/properties/details?property_id=...&currency=native` for those IDs to obtain comp performance. Use a small request queue and cached details.
6. Normalize into the report contract, retain raw responses and provenance, apply explicit user overrides, and build a new `final_report_json` snapshot. Reuse existing copy, template and Browserless PDF infrastructure with the presentation changes below.

This normally costs **one Rentalizer request plus six detail requests** before cache hits. With a 3,000-request quota, that is roughly **428 seven-call reports per period**, excluding retries, other calls and other usage. Four-card reports could fetch four detail records, but six supports existing templates and reviewer choice. Treat these as request-budget calculations, not billing quotes.

### Optional search

`/properties` returns `revenue_ltm`, `revenue_potential_ltm`, `average_daily_rate_ltm`, `occupancy_rate_ltm`, `days_available_ltm`, IDs, images and coordinates in one response. It can find replacements when Rentalizer's selection is unsuitable, or populate a keyed detail cache for overlapping IDs.

The tested search is broader than Rentalizer's nearby set and is sorted by review count. Do not replace proximity selection with the first page, claim the first page is exhaustive, or assume every Rentalizer comp appears in it. Compute distances from returned coordinates when using search. Benchmark coverage before adding an extra search call to every report. No need for for-sale search, market-manager rankings, or a separate address endpoint in the initial release.

## Field mapping and rules

| StayPacks field | Source | Required treatment |
| --- | --- | --- |
| `annualRevenue` | `data.property_statistics.revenue.ltm` | Accept finite nonnegative number; retain provider projection separately from overrides |
| `monthlyRevenue`, `weeklyRevenue` | Annual / 12, annual / 52 | Label as averages; never use these as a monthly series |
| `nightlyRate` | `data.property_statistics.adr.ltm` | Preserve reported ADR; confirm fee basis before buyer-facing terminology |
| `occupancyRate` | Rentalizer `occupancy.ltm` | Multiply fraction by 100: 0.59 → 59 |
| `bookedNights` | Projected occupancy × 365 | Derived value under full-availability assumption, not provider-observed booked nights |
| `radiusM` | No declared radius returned | Null; the furthest returned comp is 161m, which is not a declared search radius |
| Comp ID | `static_combined_property_id` / detail `property_id` | Keep string IDs including `abnb_`; join details by ID |
| Comp name, image, URL | Rentalizer `title`, `cover_img`, platform/listing URLs | Preserve canonical URLs; validate optional fields |
| Comp bed/bath/guests/distance | Rentalizer comp attributes and `distance_meters` | Already in metres; no conversion |
| Comp annual revenue | Detail `metrics.revenue`; search `revenue_ltm` | Historical estimated revenue; do not silently substitute revenue potential |
| Comp revenue potential | Detail `metrics.revenue_potential`; search `revenue_potential_ltm` | Separate optional metric for full-availability comparisons |
| Comp occupancy | Detail `metrics.occupancy`; search `occupancy_rate_ltm` | Already percentage points; do not multiply by 100 again |
| Comp ADR | Detail `metrics.adr`; search `average_daily_rate_ltm` | Use matching endpoint's revenue/ADR/occupancy together |
| Comp availability | Detail `active_listing_nights`, `days_available`; search `days_available_ltm` | Preserve both fields; do not derive historical booked nights from occupancy × 365 |
| Confidence | `property_statistics.confidence_score` | Record raw level and score; low confidence requires review policy |
| Seasonality | `revenue.revenue_years`, `occupancy.occupancy_years`, `adr.adr_years` | All null in this response; use empty series |
| Revenue range | `property_statistics.revenue_range` | Null; no provider p25/p50/p75/p90 available |

Additional observed traps:

- Rentalizer's `comps_revenues` has 50 values but no IDs. Do not join it to comp cards by array position without a provider contract confirming that relationship. Even the apparent first value ($26,373) differs from the first detail record's revenue ($26,989.33).
- Some top-level `airbnb_property_id` strings contain rounded IDs. For example, one ends in `808768` while `static_combined_property_id`, `platforms.airbnb_property_id` and the listing URL end in `808797`. Use canonical combined/platform IDs and never numeric conversion.
- Rentalizer comp `stats.revenue` and `stats.occupancy` were null for all 50 comps; ADR alone is populated there. Detail metrics fill this gap.
- The only populated monthly series is `cleaning_fee.cleaning_fee_years`. It is not revenue seasonality and must not be repurposed as a revenue chart.
- Property details expose a `redactions` array and many null amenities. Preserve these as unavailable; do not interpret null as false or absent amenity.
- Six prototype comps were selected by matching bed/bath, apartment/condo type, entire-home status, up to five guests, rating ≥4.5, at least ten reviews, then distance. They are not the highest revenue six out of all 50. Selection thresholds remain a product choice.

## Revenue meaning must be explicit

AirDNA describes Rentalizer as a forward projection under 365-day availability, while individual comp metrics describe past performance. Its documentation includes cleaning fees in revenue and describes deductions/fees separately. Validate what this third-party wrapper forwards before asserting equivalence with the current Airbtics definition. Preserve the $5,229.29 cleaning-fee component separately; do not add it to $54,083 or subtract it without an agreed definition. See [Rentalizer methodology](https://help.airdna.co/en/articles/10559022-rentalizer-revenue-calculator) and [revenue definitions](https://help.airdna.co/en/articles/8374548-how-does-airdna-calculate-revenue).

Comp occupancy uses available/active nights, not necessarily 365 days. The first hydrated comp has 177 active listing nights, 41.81% occupancy, $364.73 ADR and $26,989.33 estimated revenue. Treating 41.81% as a full-year occupancy assumption would materially misrepresent it. See [occupancy definitions](https://help.airdna.co/en/articles/8062178-how-does-airdna-calculate-occupancy-rate).

The subscription is to the RapidAPI product under `s.mahmoud97`, a separate integration from AirDNA's enterprise API. Confirm this service's field meanings, access to missing data, and permitted storage/display in branded reports with its provider before default rollout. Official AirDNA documentation explains concepts; it does not establish this wrapper's endpoint contract or entitlement.

## Code changes

### 1. Add a provider boundary and adapter

- Add `lib/str-estimates/` with a provider-neutral result, orchestration and configuration, and `lib/airdna/` for the RapidAPI client and normalization. Wrap the existing `lib/airbtics/client.ts` unchanged initially.
- Use explicit provider selection, for example `STR_ESTIMATE_PROVIDER=airbtics|rapidapi_airdna`, defaulting to Airbtics until rollout. Pin provider on each generation job so retries do not change it mid-run.
- Add server-only `AIRDNA_RAPIDAPI_KEY`, host and timeout configuration. The verified local key can populate the dedicated setting through normal secret configuration. Keep REA/Domain configuration working; do not rename their key globally. Check the Netlify function/runtime context during deployment.
- Use Zod to validate successful bodies, nested metrics and supported nullable fields. Reject HTTP failures, a populated `error` object, wrong geography/currency, or malformed core data. A 200 response alone is insufficient.
- Set bounded timeouts and retry/backoff for 429 and transient failures; honor `Retry-After` when supplied. Begin conservatively around one request per 1.5 seconds until the provider's rate limit is confirmed. Coordinate limits across concurrent Netlify workers, not only within one process.
- Cache by provider + normalized address/configuration + currency + schema version. Cache comp details by stable property ID and currency. Store fetch time and explicit freshness policy; proposed initial TTLs are 24 hours for estimates and 7 days for comp details, subject to provider terms and product expectations.
- Persist request/job state so retries resume completed detail calls. Keep mocked data explicit and prevent production fallback to development mocks.

### 2. Preserve data and snapshots

- Add provider-neutral metadata/raw storage, for example `str_provider`, `str_provider_request_id`, `str_fetched_at`, `str_request_json`, `raw_str_provider_json`, `str_schema_version`, and request-count/cost metadata. Use an additive migration; keep legacy Airbtics fields for old reports.
- Continue storing `original_estimate_json`, `user_overrides_json`, `final_estimate_json`, `str_enrichment_json` and `final_report_json` separately. Never write a RapidAPI response into `raw_airbtics_json` or label it as Airbtics.
- Extend enrichment/provenance for provider, currency, metric basis, availability, confidence, completeness and comp-selection method. The current `tier: full` value alone does not describe the new provider's capabilities.
- New reports snapshot normalized data, methodology and source metadata. Regenerating a PDF uses that snapshot without fetching new estimates or switching providers. Existing published reports must remain stable.
- Review legacy refresh helpers: `buildFinalReportJson.ts`, `resolvePlaygroundFinalReport.ts` and the public print route call Airbtics-specific comp rebuilding. Add provider-aware handling and prevent opportunistic changes to published snapshots. Preserve legacy rendering with regression fixtures.

### 3. Wire both generation paths

- Update `app/api/airbtics/estimate/route.ts` to use the provider-neutral service, preserving `requireReportWithListing` and its authorization boundary. A new `/api/str/estimate` route can become the preferred name while the old route remains a compatibility facade.
- Update `lib/delivery/str/generateHeadlessStr.ts` too: scheduled/headless generation directly calls Airbtics today. Both paths must use identical input handling, provider selection, normalization and persistence.
- Update `components/reports/StrEstimateStep.tsx`, relevant Zod schemas, report drafts/types, and API-specific progress/cost text. Audit scripts that directly call `fetchAirbticsEstimate` and label legacy-only tools clearly.
- Keep third-party keys and calls server-side, Supabase as source of truth, and Browserless for final PDFs. No n8n or client `window.print()` path is needed.

### 4. Adapt positioning and presentation

`lib/airbtics/positionEstimate.ts` requires at least two provider percentile points plus comps. Feeding Rentalizer raw JSON into it will not reproduce the existing positioning behavior. The current result's rationale and clamp rules are tied to Airbtics' distribution.

- For the initial provider rollout, keep Rentalizer's projection as the original and initial final estimate. Retain explicit manual overrides. Low provider confidence should flag the draft for review rather than silently receive a confidence uplift.
- If later adding comp-aware positioning, accept a normalized evidence object and calibrate on a representative validation set. Do not invent Airbtics percentile fields or call empirical comp quantiles the subject's provider range. Keep partial-year revenue and full-availability revenue potential distinct.
- Update `lib/reports/strEstimateAdjustments.ts`: the existing fallback slider treats ±20% as p25/p90-shaped values. Any fallback adjustment band must be labelled an editable scenario, not a provider percentile range.
- Update `ClassicMonthlyRevenueChart.tsx`: it currently fabricates ±25% chart bands when monthly low/high are missing. For the new provider, show only supplied series/ranges; omit absent charts. Market-level seasonal data, if obtained later, needs its own label and cannot masquerade as a property projection.
- Update `ClassicMarketInsights.tsx` and chart labels: an unpositioned estimate is currently called “Median”. Rentalizer's projection is not known to be a median. Use “Estimated gross STR revenue”.
- Update `ClassicCompsGrid.tsx` and affected template variants: “Top 4 of 50 ... by estimated gross revenue” is false if only six detail lookups were ranked. Label them “selected nearby comparable listings”. Distinguish historical estimated comp revenue from full-availability potential where used.
- Reflow page two when seasonality/ranges are unavailable. Use comp evidence, projected metrics, availability assumptions and the disclaimer instead of empty chart space.
- Keep provider names out of buyer-facing copy and retain the approved estimate disclaimer on every report. Check fee-sensitive “before costs” and ADR wording against the agreed metric definition.

## Delivery sequence and acceptance gates

1. **Adapter and offline fixtures — approximately 1 day.** Add typed normalization, shared rate limiting, error handling and provider configuration. Replay the captured responses without consuming quota. Accept only when currency, occupancy scales, stable IDs, nulls and 200-with-error behavior pass tests.
2. **Persistence and both generation paths — approximately 1 day.** Add migration and provenance, wire interactive and headless jobs, preserve overrides and historical reads. Verify authorization and resumable failures.
3. **Report behavior — approximately 1 day.** Fix range/median/comp labels and no-seasonality layout; support low-confidence review. Generate and visually verify Browserless PDFs for each affected STR template.
4. **Controlled comparison and rollout — approximately 1–2 days of engineering plus a chosen observation period.** Compare 10–20 representative Australian listings across apartments/houses, regions, high/low supply and bedroom counts. Flag differences above a chosen review threshold (suggested 20%); this is a triage threshold, not an accuracy score. Compare with known booking results when available. Enable an internal agency first, then expand after review.

Estimated implementation effort: **4–5 engineering days**, depending on provider answers and existing template coverage. Restoring full monthly/percentile parity may require the provider to change access or payloads; do not promise that work can be completed solely in StayPacks.

Required checks before the default switch:

- Annual estimate, verified currency/location/configuration, and usable comp cards survive normalization and final JSON generation.
- Null/redacted data, low confidence, no comps, partial detail failures, timeouts, 429s and HTTP-200 error envelopes have explicit outcomes. Empty data must not become zero revenue or an invented successful estimate.
- Tests cover fractional Rentalizer occupancy versus percentage-point detail/search occupancy, large string IDs, cleaning-fee series rejection, historical revenue versus potential, and overrides.
- Interactive and headless paths produce equivalent snapshots for the same inputs. Low-confidence/review-required reports cannot be auto-published by headless delivery.
- Old published reports and PDFs remain stable; only a new revision requests new data.
- Snapshot rendering works without percentiles and seasonality; no invented ranges or inaccurate selection labels appear in HTML or Browserless PDF.
- Aggregate request limiting and caching work under concurrent jobs; quota/cost dashboards no longer reuse Airbtics' hardcoded 50-cent full-tier assumption.
- Provider questions are settled or the reduced report has been explicitly accepted: missing monthly/percentile access, fee definitions, rate limits, usage terms and pricing.

Rollback is a configuration change for **new generations** back to Airbtics. Never relabel an already generated report, mix provider payloads within one snapshot, or silently switch the provider during a failed job. Keep the Airbtics subscription until the new path has completed the agreed observation period.

## Local artifacts and validation

Artifacts are in the git-ignored directory `tmp/str-api-comparison-2026-10-09/`:

- `comparison.html` — comparison and links to both report previews.
- `airbtics-report.html`, `airbtics-final-report.json` — saved current report, with fresh API baseline checked separately.
- `airdna-report.html`, `airdna-final-report.json` — new API prototype using the existing template and six hydrated comps. The HTML includes preview-only wording corrections and a missing-data note; these changes have not been applied to application code.
- `airdna-normalized-estimate.json`, `comparison-summary.json` — mapped data and provenance.
- Captured response/request metadata files for Airbtics, Rentalizer, details, search and the failed market metric request. Request metadata omits authentication headers.
- `build-comparison.mjs` — offline artifact generation and assertions. Run inside the existing container: `docker compose exec app node tmp/str-api-comparison-2026-10-09/build-comparison.mjs`.

The comparison checked the exact address/configuration/coordinates, six successful keyed AUD detail records, the unchanged Airbtics baseline, occupancy normalization, null ranges/seasonality, removal of the old headline from new copy, and preservation of the disclaimer. Full application tests were not run because the integration has not been modified. No Supabase writes, Netlify changes, publication, commits or provider switch were performed.
