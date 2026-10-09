# Report-focused workflow validation

Implemented 9 October 2026. Preview: https://report-tool-staging--staypack.netlify.app/dev/lint-regression

Initial report-tool deployment: `6ac825e9ce5d8ed434e20d34`. Final manual-appraisal preview deployment: `6ac83a6453f1e5488011c0fa`.

Click **Start mock test session** and choose a test screen. All saves in this harness are synthetic and reset on reload. Validation ran on preview deployments before release to main. A later user-authorised live test created and archived temporary QA records in the shared database; see below. Existing customer records were not changed.

## Resulting behaviour

- New reports default to no link or QR. Each STR report, lease appraisal, and sales appraisal independently chooses no QR, its own online report, or a custom website.
- Sales/rental brochures and business cards choose no QR or a custom website. Cards no longer require a linked property to choose a destination.
- A saved report/brochure link edit remains pending until publication. Existing published assets stay unchanged; public and print responses exclude the unpublished destination. Publishing applies the choice and invalidates the old PDF. Cards apply their choice on save.
- New QR images encode the selected destination directly and use unique storage filenames. Copy regeneration and automated report generation preserve the appropriate choice. Older documents keep their original QR unless explicitly changed.
- The main navigation, dashboard, property library and workspace no longer present enquiry management, property-page controls or landing-page analytics. New property creation, scraping and report generation do not provision landing pages.
- Previously provisioned public pages and printed redirects remain available. Old forms are replaced with agent contact details; submission/status/QR-regeneration endpoints return 410. New unprovisioned property slugs return 404. Enquiry history is removed from Settings and the old enquiries page returns 404.
- All existing source, database history and stored assets are retained. No database migration is required. See the dependency inventory and restoration notes in [the audit](property-pages-deprecation-audit.md).

## Checks

| Check | Result |
| --- | --- |
| Complete Vitest suite | 312 tests pass across 54 files |
| Template coverage within unit suite | 31 report templates and 32 sales/rental brochure templates, QR on/off |
| API and workflow coverage | Invalid URLs, denied access, concurrent-save conflict, persistence failure, immutable QR assets, default/off/custom destinations, all three report publishers, brochure/card settings, pending-PDF guard, headless STR/lease/brochure generation and legacy redirects |
| TypeScript | `tsc --noEmit` passes |
| ESLint | 0 errors; 58 existing warnings, down from 59 before this work |
| Production build | Passes; Next.js reports the existing middleware-convention deprecation |
| Production-mode smoke checks | Both synthetic routes return 404; the retired enquiries route remains behind authentication and returns 404 when signed in; retired write routes return 410; homepage returns 200 |
| Deployed browser scenarios | 26 scenarios pass against the final preview, including print-width checks for business cards and brochures with QR on/off |
| PDF exports | 28 synthetic PDFs: 14 report/brochure/card configurations, each with QR on/off. Expected page counts and A4/90×55 mm sizes checked |
| QR verification | Rasterized PDFs decoded and compared with the exact selected URL; no non-empty QR payloads in disabled documents |

Browser scenarios exercise real components sequentially with in-memory API mocks and fail if an app API request escapes the mock boundary. They include save/publish/republish, changing and removing destinations, mobile controls, validation and failed-save recovery, retained editor regressions, and absence of the retired workspace controls.

PDFs use the deployed print components rendered by Chromium, then rasterized for visual inspection and QR decoding. This caught and fixed layouts that suppressed an explicit QR and an A4 body-width rule that shrank business cards. The export fixtures intentionally contain sparse appraisal/comparable data; external demo images are not part of the pass criteria. QA artifacts are in the ignored `tmp/pdfs/` directory.

## Test boundaries

The initial automated browser suite mocked database access, storage writes, estimate/copy services, managed delivery and the Browserless API boundary. The additional real-account testing below exercised live persistence and PDF generation. No emails or delivery jobs were sent.

The two synthetic routes are enabled only in development or an explicit `STAYPACK_REGRESSION_PREVIEW=1` preview build. The normal production build was checked with that flag disabled. Do not set the preview flag on production.

## Authorised real-account staging test — 9 October 2026

The user signed into the preview and explicitly authorised labelled temporary QA records in the shared production database, followed by archival. Tests used `[QA 2026-10-09] 1 Test Street` and five generated QA placeholder photos. Existing customer records were not edited.

| Live check | Result |
| --- | --- |
| Manual property creation, photo upload and selections | Saved; no property-page URL, landing QR or publication timestamp was created |
| Sales brochure generation | Real copy service completed; default link choice was `none` |
| Custom brochure destination | Saved, survived reload and published; Browserless produced a two-page A4 PDF whose QR decoded to the exact selected `example.com` QA URL |
| Published brochure changed to no QR | Draft remained pending while published choice/PDF stayed unchanged; republishing removed the QR and generated a replacement PDF; neither rasterized page contained a QR payload |
| STR report | Real estimate and copy generation completed; its independent `report` destination survived reload, published and generated a two-page A4 PDF; QR decoded to its own public report URL |
| Template picker | Found and fixed an unwanted placeholder QR; template previews now respect the saved or pending document choice. Three regression tests added; live QR-off preview verified |
| Previous enquiries | Settings entry absent; authenticated `/leads` returns 404 |
| Cleanup | One QA listing, two QA reports and three QA collateral items archived; zero active QA reports, collateral or appraisal jobs remain; archived public STR URL returns 404 |

The three actual Browserless PDFs were rasterized and visually inspected. All had the expected two A4 pages, readable content and disclaimer. Artifacts and the exact cleanup ledger are in ignored `tmp/live-qa/`.

### Manual-listing defect discovered during the initial live test

Rental appraisal creation and template selection succeeded, but fetching comparables failed with “suburb, state, postcode, and bedrooms are required.” The manually entered listing has those fields; the existing enrichment code reads only `scraped_listing_json`, which contains none of them for a manual listing. Both `enrichListingForLeaseAppraisal.ts` and `enrichListingForSalesAppraisal.ts` used that same input pattern at the time of this test. The failed rental job is terminal and its draft/report was archived. This prevents claiming a complete live rental-appraisal pass; sales-appraisal and business-card end-to-end coverage remains automated/mocked. This separate issue was subsequently fixed and tested as described below.

Checks after the initial preview fixes: 312 unit tests across 54 files passed, TypeScript passed, ESLint had zero errors and 58 existing warnings. Netlify built and deployed the tested preview successfully. The subsequent manual-appraisal checks below supersede this unit-test total.


## Manual rental/sales appraisal fix — 9 October 2026

Final staging build: `6ac83a6453f1e5488011c0fa`. The live worker/PDF checks ran on `6ac8365555cf52f09f02b4d3`; the final deployment additionally includes the four valuation-cache regressions, legacy stale-evidence fix and alternate-endpoint failure handling covered by the complete automated suite. Google Places is excluded. There is no database migration. These checks were completed before release to main.

### Behaviour

- A shared working input overlays saved property fields onto imported data, including explicit clears. A manual property needs no URL or imported JSON. Uploaded photos and saved agents remain available.
- Enrichment validates the actual saved suburb, state, postcode and positive whole-number bedroom count before calling a provider. Errors identify the missing fields. Completed searches without suitable evidence have a separate empty-result state.
- Only generated evidence is merged back into storage; edited facts do not overwrite original imported subject data. Agent saves no longer strip appraisal results, comparable pools or enrichment metadata.
- Appraisal input fingerprints invalidate old evidence when the subject changes. A separate valuation fingerprint prevents one stale appraisal from discarding the other appraisal's newly refreshed valuation. Legacy evidence already known to be stale stays stale until refreshed.
- Listing and evidence writes compare `updated_at` so delayed work cannot overwrite a newer save. Provider failures propagate as failures, including repeat attempts and the alternate rental endpoint.
- Draft creation, template previews, data selection, copy generation/editing, rebuilds and the existing-listing headless lease path use the same effective property input. Published/generated snapshots are not automatically rewritten by property edits.

### Automated checks

361 tests pass across 59 files in the Node 24 Linux container. TypeScript passes; ESLint has zero errors and 58 existing warnings. Coverage added for null/empty imports, corrected imports, deliberately cleared fields, invalid/missing fields, numeric normalisation, uploads, agent-only saves, both appraisal types coexisting, stale evidence and shared valuations, repeat provider failures, empty results, storage failures, concurrent writes, manual draft/preview/generation, snapshot contents and the alternate rental endpoint.

### Live backend and PDF checks

The existing explicit permission for temporary labelled QA records in the shared database was reused. Test property: `[QA APPRAISAL 2026-10-09] 1 Test Street`, Bondi NSW 2026; three bedrooms, two bathrooms and one car space. Subject address/photos were synthetic, with `listing_url = null` and initially `scraped_listing_json = null`. Only this new QA property and its new child records were modified.

| Check | Result |
| --- | --- |
| Deployed rental background worker | Completed with 29 comparables; manual suburb/state/postcode/bedrooms accepted |
| Deployed sales background worker | Completed with 28 comparables (17 sold, 11 for sale); rental results retained |
| Real persistence | Subject fields remained in editable columns; imported JSON did not acquire invented original address/suburb/bedroom facts |
| Agent edit | Both comparable pools survived the save and reload |
| Concurrent save protection | A write using the previous database timestamp was rejected; newer edit remained intact |
| Real copy generation | Both draft reports generated and saved property facts, selected comparable evidence and disclaimers |
| Browserless PDFs | Both rendered through staging's signed preview print route with the same image/stylesheet mirroring callbacks as the export route; each is two A4 pages |
| PDF inspection | All four pages rasterized and visually inspected; manual facts, QA photos, six featured comparables and visible disclaimers verified |
| Subject correction | Changing bedrooms from 3 to 4 invalidated both appraisals without deleting stored evidence; returning to the exact original facts restored matching evidence |
| Snapshot stability | Both saved report JSON snapshots remained byte-for-byte unchanged during subject edits |
| Cleanup | One new listing, two new reports and two new collateral items archived; both jobs terminal; no active QA jobs |

The deployed background workers used their real external services. Draft/report generation was invoked through the application's server functions from the Node 24 container with real database and copy-service access. PDFs used the actual Browserless service and the deployed staging print route. The first diagnostic PDF call omitted the route's asset-mirroring callbacks and produced unstyled output; it was corrected to match the application export path, then both final PDFs passed two-page, content and visual checks.

### Authenticated UI follow-up on the final staging build

The user completed sign-in during testing. The same temporary QA records were restored briefly, tested, then archived again.

- Cleared postcode through Settings and saved. Rental appraisal displayed “Add postcode in property details before fetching comparables”, disabled fetch/continue, and did not start another search. Restoring postcode restored matching evidence.
- Saved rental and sales data through the actual editor controls; both kept six selected comparables and their saved ranges.
- Edited and saved each report heading through Content generation. Preview displayed the persisted edited headings.
- Published both through the actual Publish appraisal buttons. Both completed Browserless generation, exposed Download PDF and changed to Republish appraisal. Database records confirmed published status and stored PDF URLs.
- Downloaded the published rental PDF through the authenticated app route; verified two pages, the edited heading and disclaimer.
- The final sales download click was denied by browser permission. No workaround or alternate download was attempted. Sales publication and stored PDF generation succeeded, and the earlier actual Browserless sales PDF had already passed two-page/content/visual checks. This remains a narrow download-click verification boundary, not an observed application failure.
- Final cleanup again archived the single QA listing, two reports and two collateral items; database counts confirm zero active child records or jobs. No emails or delivery jobs were sent.

Production build also passes in the Linux Node 24 container. Screenshot evidence: `tmp/manual-appraisal-qa/missing-postcode.jpg` and `rental-published.jpg`.

Evidence and cleanup ledger: ignored `tmp/manual-appraisal-qa/records.json`; final PDF files and raster previews in the same directory. The reusable one-off backend QA driver is ignored at `.netlify/manual-appraisal-qa/live-backend.mts`.
