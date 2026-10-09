# Property pages deprecation audit and execution plan

Retire property landing pages, buyer lead management, and landing-page analytics from the main StayPacks workflow. Keep property records as the reusable input for reports. Make any link or QR printed on a document an explicit choice on that individual report, brochure, or business card.

The inventory and plan below describe the repository at commit `89a4912`, dated 8 October 2026. The approved implementation is now complete in the workspace and deployed to a mock-enabled preview. See the implementation notes at the end of this document and [validation results](report-tool-validation.md). The production deployment and existing customer records were not changed. Subsequently authorised QA records were created and archived in the shared database; see the validation results.

## Recommended product behaviour

In each report's preview and publishing step, offer **Include a link and QR code**, off by default for new documents. When enabled, choose the online version of this report or enter a custom destination, such as an agency's listing page. Show the destination and the wording that will appear beside the QR before publishing. For document types without an online viewer, offer a custom destination only.

Store this choice on the report or collateral item. Preserve it when copy, images, estimates, or templates are regenerated. Snapshot the chosen destination, label, and QR asset into the published document JSON. A change to one report or to its underlying property must not silently change another document's link.

Generate new QR codes from that document's chosen URL. Use a document-specific redirect only if changing a printed document's destination later becomes an explicit product requirement. Do not reuse the existing listing-wide `/go` redirect for new documents.

Keep normal online report publishing, PDF generation, sharing, property data, agency branding, and agent contact details. None requires buyer lead capture. Remove Leads navigation, enquiry statuses, landing-page analytics, property-page templates, and listing-wide destination controls from the main workflow. Preserve their code and historical data without exposing an enquiry-history interface. The user subsequently requested removal of previous enquiries too.

Existing public property pages and printed QR codes need a compatibility path. Recommended policy: keep previously issued destinations working, retire the legacy enquiry form in favour of agent contact details, and retain historical enquiries. Confirm that form policy against actual usage before rollout. Do not delete old rows, stored assets, or routes in the first release.

## Why a single toggle is insufficient

| Finding | Consequence |
| --- | --- |
| Report and collateral QR generation encodes `/go/{agencySlug}/{listingSlug}`. The redirect reads the listing's current `custom_landing_url`, falling back to its hosted page. | Different documents for one property share one mutable destination, despite having separate QR image files. Changing the property URL can redirect several already printed documents. |
| Landing-page provisioning runs during listing creation, scraping, editing, workspace loading, report publishing, brochure generation, and automated delivery. | Hiding the property-page card would still create pages and QR assets behind the scenes. |
| The public property page and lead submission API check for an active listing and slug, not a feature-enable flag or `landing_published_at`. | Stopping provisioning alone does not prevent a new active listing from having a public page or accepting a direct lead submission. |
| Brochure generation uses the QR provisioning result to obtain its listing, and fails when that result is absent. | Making QR optional needs a small separation of listing preparation from QR generation. |
| Copy regeneration provisions another listing QR and rebuilds the document. | A future per-report selection could be overwritten unless regeneration preserves it. |
| Interactive STR, lease, and sales appraisals share the report publisher; automated generators also publish directly. | Both interactive and background paths need the same destination rules. |
| Brochure layouts are reused inside report templates. | Deleting those layouts would damage reports, even after property pages are retired. |
| Analytics combines direct hosted-page visits and QR redirects, including redirects to external sites. Events distinguish `direct` and `qr`, not historical destination type. | Historical conversion cannot be reliably recast as report analytics. Preserve the history without relabelling it. |

## User interface and navigation inventory

Paths below are relative to the repository root. Each group identifies the relevant direct dependencies and implementation touchpoints; it is not a deletion list.

| Files | Current responsibility and proposed treatment |
| --- | --- |
| `components/app-shell/AppShell.tsx` | Leads entry in the shared desktop and mobile navigation. Remove from primary navigation. |
| `middleware.ts` | Protects `/leads`. Keep authentication on any retained history route. |
| `app/(app)/dashboard/page.tsx`; `components/dashboard/DashboardAnalytics.tsx`; `app/(app)/dashboard/loading.tsx` | Unconditional landing-page analytics and related loading UI. Remove that block; keep the core dashboard and recent property/report work. |
| `app/(app)/listings/page.tsx`; `components/listings/ListingLibrary.tsx` | Loads lead counts and renders Total leads. Remove the query, column, and associated table sizing. Keep the property library. |
| `app/(app)/listings/[listingId]/page.tsx` | Provisions a landing page on workspace access and loads lead/view metrics. Stop those side effects and remove the CRM queries. |
| `components/listings/ListingWorkspace.tsx` | Metrics strip, conversion, property-page card, copy/view link, template preview, QR regeneration, custom listing URL, Leads tab, and lead-status editing. Retire these together; keep property details and report/collateral tools. |
| `app/(app)/leads/page.tsx`; `app/(app)/leads/loading.tsx`; `components/leads/LeadsInbox.tsx`; `components/leads/LeadStatusControl.tsx`; `lib/leads/groupLeads.ts` | Enquiry inbox, grouped people, search, new/contacted statuses, live polling, and status updates. Retain source and database history for restoration; disable the page and stop normal polling and CRM use. |
| `components/listings/LandingTemplatePreviewModal.tsx`; `components/listings/LandingTemplatePreviewBar.tsx` | Property-page template previews and writes. Remove from normal UI; retain code for possible restoration. |
| `components/reports/ReportWizard.tsx`; `components/lease-appraisal/LeaseAppraisalWizard.tsx`; `components/sales-appraisal/SalesAppraisalWizard.tsx`; `components/collateral/sales-brochure/SalesBrochureWizard.tsx` | Proposed place for each document's optional destination control, near preview/publishing. Existing report-sharing controls stay. |
| `components/collateral/business-card/BusinessCardLayerPanel.tsx`; `components/collateral/business-card/BusinessCardEditor.tsx` | Business cards already have a QR display switch, but choose their destination using a property picker. Preserve optional QR capability and move its target to the individual card. |

## Public pages and API inventory

| Files | Current responsibility and proposed treatment |
| --- | --- |
| `app/(public)/[agencySlug]/l/[listingSlug]/page.tsx` | Hosted property lead-capture page, template selection, owner preview controls, and view tracking. Limit it explicitly to legacy eligible pages before stopping new provisioning. |
| `lib/listings/templates/registry.ts`; `lib/listings/templates/types.ts`; `lib/listings/templates/minimal/MinimalLandingTemplate.tsx`; `lib/listings/templates/classic/ClassicLandingTemplate.tsx` | The two property-page templates and their contract. Preserve as legacy code; these are separate from the report template system. |
| `components/listings/ListingLeadForm.tsx`; `components/listings/ListingViewTracker.tsx`; `components/listings/ListingImageGallery.tsx` | Public enquiry form, visit recording, and page gallery. Apply the legacy-form policy at both UI and API levels. Keep shared image functionality where needed. |
| `app/(public)/go/[agencySlug]/[listingSlug]/route.ts`; `lib/listings/listingUrls.ts` | Old printed QR redirect, URL selection/canonicalisation, and tracking parameter. Keep existing redirect behaviour available; new document QR generation must stop depending on it. |
| `app/api/public/leads/route.ts` | Public lead creation using a server-side client. Enforce the retirement policy here too; removing a form alone does not disable submissions. |
| `app/api/public/track-view/route.ts`; `lib/listings/pageViews.ts` | Public view recording, bot filtering, and event storage. Define whether legacy event recording continues; do not repurpose these as report analytics. |
| `app/api/analytics/overview/route.ts` | Agency-wide page views, leads, and conversion inputs. Retire the normal dashboard consumer; keep history separately if needed. |
| `app/api/leads/route.ts`; `app/api/leads/[leadId]/route.ts`; `app/api/listings/[id]/leads/route.ts`; `app/api/listings/[id]/leads/[leadId]/route.ts` | Agency and listing lead reads plus status mutations. Retain only the required authenticated history capability when CRM editing is retired. |
| `app/api/listings/[id]/regenerate-qr/route.ts` | Listing-wide QR regeneration. Retire normal use while retaining the existing assets referenced by published documents. |

## Provisioning and document generation inventory

| Files | Current responsibility and proposed treatment |
| --- | --- |
| `lib/listings/provisionLandingPage.ts` | Creates listing public URLs, QR assets, and landing publication metadata; also provides a slug helper used elsewhere. Stop automatic page provisioning without accidentally removing shared slug generation. |
| `app/api/listings/route.ts`; `app/api/listings/[id]/route.ts`; `app/api/listings/scrape/route.ts`; `lib/listings/prepareListingFromScrape.ts`; `app/(app)/listings/[listingId]/page.tsx` | Listing creation, editing, scraping, shared outreach preparation, and page load all invoke provisioning. Remove each implicit page-creation path. Keep property creation/scraping intact. |
| `lib/listings/emptyListingDraft.ts` | Initial landing-page fields. New drafts should no longer imply an enabled hosted page. |
| `lib/collateral/provisionCollateralQr.ts`; `lib/collateral/generateCollateralDocument.ts` | Shared QR generation currently provisions a hosted page and requires its destination. Separate listing preparation from optional document QR generation. Sales and rental brochures must work with no QR. Social-post generation has an early return and should retain its existing behaviour. |
| `app/api/collateral/[id]/generate/route.ts`; `app/api/collateral/[id]/generate-copy/route.ts`; `app/api/collateral/[id]/publish/route.ts`; `app/api/collateral/[id]/route.ts` | Generation, copy regeneration, publishing, document updates, and business-card listing selection. Respect the document's destination choice in all paths. |
| `app/api/reports/[id]/publish/route.ts` | Shared interactive publisher for STR and both appraisal types. Currently ensures a property page and assigns the listing QR. Make QR optional and document-owned. |
| `app/api/reports/[id]/route.ts` | Saves report changes and rebuilds final JSON after copy/template/estimate changes. Preserve the report's destination selection during rebuilds. |
| `lib/reports/buildFinalReportJson.ts`; `lib/lease-appraisal/buildLeaseAppraisalReport.ts`; `lib/sales-appraisal/buildSalesAppraisalReport.ts`; `lib/reports/emptyReportDraft.ts` | Final report construction and QR asset propagation. Add the document destination contract without changing the meaning of the source listing URL. |
| `lib/collateral/buildSalesBrochureDocument.ts`; `lib/collateral/buildBusinessCardDocument.ts`; `lib/collateral/business-card/normalizeBusinessCardDocument.ts` | Brochure/card target and QR fields. Sales and rental brochures share the builder module. Make absence of QR an intentional supported state. |
| `lib/reports/finalReportToBrochureShape.ts`; `lib/collateral/sales-brochure/toReportShape.ts` | Report/brochure shape conversion. Currently the former derives target metadata from `property.listing_url`, which is source data rather than a dedicated report destination. Carry the explicit document choice instead. |
| `lib/collateral/sales-brochure/brochurePublishSync.ts` | Uses content-save/PDF-sync timestamps to identify stale PDFs. Destination edits must count as content edits so an old PDF is not presented as current. |
| `components/reports/GeneratedCopyEditor.tsx`; `components/collateral/sales-brochure/GeneratedBrochureCopyEditor.tsx` | Editing and regeneration touchpoints to verify: changing copy must preserve a document's optional link setting. |
| `lib/reports/qr.ts` | Generic server-side QR image generator. Keep and reuse for document URLs. |

## Automated generation and delivery inventory

| Files | Current responsibility and proposed treatment |
| --- | --- |
| `lib/delivery/str/generateHeadlessStr.ts` | Publishes STR reports directly, explicitly provisions property pages, creates a listing redirect QR, and requires a destination. Apply the new per-output choice here as well as in the interactive publisher. |
| `lib/delivery/brochure/generateHeadlessSalesBrochure.ts` | Uses shared collateral QR provisioning and embeds its result in published brochures/PDFs. Support QR off and an explicit per-brochure destination. |
| `lib/delivery/lease/generateHeadlessLeaseAppraisal.ts` | Publishes appraisal reports directly and imports the provisioning module's slug helper. Preserve report publication; shared preparation can still create a page upstream. |
| `lib/delivery/listing/createDeliveryListing.ts` | Creates delivery listings using the shared slug helper. Preserve property records independently of public-page eligibility. |
| `lib/delivery/outreach/generateOutreachBundle.ts`; `lib/listings/prepareListingFromScrape.ts` | Shared listing preparation can provision a page even for an appraisal-only bundle. Apply destination settings separately to each requested output. |
| `lib/delivery/orchestrator/processListing.ts`; `lib/delivery/orchestrator/runTenantDelivery.ts` | Scheduled delivery orchestration into headless generators. Pass explicit output settings or the new-document default. Keep report delivery and its operational tracking. |
| `app/api/delivery/generate/route.ts`; `app/api/delivery/cron/route.ts`; `app/api/delivery/tenants/[slug]/run/route.ts` | Manual/batch/cron entrypoints into those generators. Include them in regression coverage. |
| `lib/delivery/outreach/schema.ts`; `lib/delivery/tenants/schema.ts`; `lib/delivery/types.ts` | Integration/configuration touchpoints if automated runs need an explicit link option. Default to no added QR when no selection is supplied; do not infer it from the listing. |
| `scripts/run-single-str-report.mjs`; `scripts/run-cbp-haven-delivery-test.mjs`; `scripts/run-harcourts-local-lease-test.mjs` | Direct headless-generator callers. Keep them aligned with the per-output contract. |

The Netlify functions present in this checkout are `lease-appraisal-enrich-background.mts` and `sales-appraisal-enrich-background.mts`; do not remove appraisal enrichment as part of CRM retirement. Report links in delivery responses, emails, and digests are still core report functionality. Delivery tenant and property-ledger administration are separate from the buyer enquiry inbox.

## Templates and PDF layout inventory

| Files | Current responsibility and proposed treatment |
| --- | --- |
| `lib/collateral/templates/sales-brochure/shared/BrochureClosingBand.tsx` | Shared QR/contact closing section, including “Scan to view the listing”. Make the label reflect the chosen destination; verify spacing with QR off. |
| `lib/reports/templates/classic/ClassicAgentFooter.tsx` | Report footer QR and agent details. Keep contact details when QR is absent. |
| `lib/collateral/templates/sales-brochure/belle/BelleLayout.tsx`; `bold/BoldLayout.tsx`; `gallery/GalleryLayout.tsx`; `landmark/LandmarkLayout.tsx`; `refined/RefinedLayout.tsx`; `split/SplitLayout.tsx` under the same sales-brochure template directory | Direct QR consumers, already conditionally rendering QR images. Preserve layouts and verify no empty space or misleading CTA when QR is off. |
| `lib/reports/templates/shared/ReportBrochureStylePageOne.tsx` | Reuses brochure layouts for report pages. Keep this shared renderer and its template families. |
| `lib/collateral/templates/business-card/classic/ClassicBusinessCard.tsx`; `lib/collateral/templates/business-card/registry.ts` | Card rendering and optional-property-QR description. Preserve the QR display setting and use the new destination contract. |
| `lib/collateral/templates/sales-brochure/registry.ts` | Template descriptions, including QR copy. Update descriptions only where the changed behaviour makes them inaccurate. |

The shortened layout paths in the table are all under `lib/collateral/templates/sales-brochure/`. Classic and editorial brochure consumers also reach the shared closing band; test the registered template families, not just files that mention a QR field directly.

## Data contracts and migrations inventory

| Files or stored data | Current responsibility and proposed treatment |
| --- | --- |
| `lib/types/index.ts` | Listing landing fields; Lead/LeadStatus/LeadWithListing; report and collateral publication/QR fields. Keep legacy contracts while adding an explicit document-level link setting. |
| `lib/collateral/templates/types.ts` | Brochure/card QR target fields and published document contracts. Version or default new optional fields so old JSON continues to render. |
| `lib/validation/schemas.ts` | Listing custom URL/template inputs, lead submission/status inputs, business-card QR listing/display fields, and document update schemas. Separate legacy inputs from new document settings; validate custom URLs server-side. |
| `supabase/migrations/011_listing_landing_leads.sql` | Adds property-page fields, required public slugs, leads, triggers/indexes/RLS, **and the collateral item registry with report backfill**. Do not delete or roll back this entire migration. |
| `supabase/migrations/012_custom_landing_url.sql`; `013_listing_analytics.sql`; `016_listing_page_view_source.sql`; `021_listing_landing_template.sql` under `supabase/migrations/` | Legacy external destination, page-view events, direct/QR source, and template selection. Preserve history; use additive changes for explicit legacy eligibility or new document settings. |
| `supabase/migrations/001_initial_schema.sql`; `014_collateral_templates.sql`; `015_collateral_image_selections.sql`; `017_agency_brand_advanced.sql` under `supabase/migrations/` | Shared reports, document JSON/QR fields, image selections, and branding. These remain necessary after CRM retirement. |
| `lib/listings/prepareListingInput.ts`; `lib/listings/collateralImages.ts`; `lib/listings/collateralImageLimits.ts`; `components/listings/CollateralImageEditor.tsx` | The `landing` image channel shares normalisation with property hero/gallery data and collateral image selection. Preserve source photos and report image controls while separating any page-specific selection. |
| Existing `reports.final_report_json`, `collateral_items.document_json`, QR/PDF assets, leads, and listing page-view rows | Preserve existing snapshots, assets, and history. Do not regenerate old documents or repoint old QR links as a side effect of rollout. |

The new-document default must not reinterpret a legacy document with missing link metadata as “QR off”. Distinguish new documents from existing published documents and preserve legacy assets until the owner explicitly changes and republishes that document.

## Copy documentation and test inventory

| Files | Required review |
| --- | --- |
| `app/page.tsx` | Homepage metadata, hero, proof text, and product promises include property pages and lead capture. Update these to match the report product. A “live page” should clearly mean the online report if retained. |
| `app/(app)/listings/new/page.tsx` | New-property description promises a property page. Replace that promise with the report workflow. |
| `components/settings/BrandSettingsForm.tsx`; `components/settings/AdvancedStylesEditor.tsx`; `components/settings/BrandAdvancedSettingsModal.tsx` | Help text refers to property pages and enquiry forms. Preserve shared brand/style controls while removing obsolete promises. |
| `README.md`; `staypack_cursor_fullstack_scaffold_v2.md` | QR/publication architecture and development documentation. Mark obsolete feature guidance and describe document-owned links. Preserve approved report disclaimers. |
| `app/dev/listing-hero/page.tsx`; `app/dev/listing-hero/ListingHeroPrototype.tsx` | Property-page prototype. Keep as an explicitly legacy development example or retire the development entrypoint. |
| `app/dev/lint-regression/page.tsx`; `app/dev/lint-regression/l/mock/page.tsx`; `components/dev/LintRegressionPlayground.tsx`; `components/dev/lintRegressionFixtures.ts`; `tests/staging/lint-regression.spec.ts` | Preview regression harness mixes CRM, public-page, and core report cases. Retain relevant report coverage, isolate legacy compatibility cases, and add per-report destination scenarios. |
| `components/dashboard/DashboardAnalytics.test.ts`; `components/listings/ListingImageGallery.test.ts`; `lib/reports/finalReportToBrochureShape.test.ts`; `lib/collateral/templates/sales-brochure/registry.test.ts` | Existing affected tests to update or retain depending on legacy support. Add behaviour-focused tests for optional QR and independent document destinations. |
| `lib/collateral/sales-brochure/playgroundFixture.ts`; `lib/collateral/sales-brochure/templatePreviewDocument.ts`; `lib/collateral/sales-brochure/resolvePlaygroundSalesBrochure.ts`; `lib/reports/strPlayground.ts`; `lib/branding/kits/belle.ts`; `lib/branding/kits/haven.ts`; `lib/reports/hydrateFinalReportBlurbVariants.test.ts` | Fixture, preview, and brand data contain QR assets, including empty QR values. Maintain compatibility and include representative enabled/disabled examples. |
| `scripts/regenerate-listing-copy.mjs`; `scripts/build-rental-brochure-fixture.mjs`; `scripts/rerun-str-report-beds.mjs`; `scripts/rerun-str-positioning.mjs` | Rebuilds and fixtures copy existing QR fields. Preserve the new destination metadata too; do not silently revert to the listing destination. |

## Core functionality to preserve

These published report and print routes serve the report product and are not the hosted property enquiry page:

- `app/(public)/[agencySlug]/[reportSlug]/page.tsx`
- `app/(public)/[agencySlug]/[reportSlug]/print/page.tsx`
- `app/(public)/[agencySlug]/c/[collateralSlug]/print/page.tsx`
- `app/(public)/p/[reportId]/print/page.tsx`
- `app/(public)/p/collateral/[collateralId]/print/page.tsx`
- `app/api/reports/[id]/generate-pdf/route.ts`
- `app/api/collateral/[id]/generate-pdf/route.ts`

Keep Browserless PDF generation, report templates, stored report JSON, source listing URLs and scraping, source photos, agency branding, agent profiles/contact details, and report delivery. `components/reports/ListingUrlStep.tsx` collects the source property URL; it is not the proposed optional destination setting.

Search terms have misleading matches: “lead” can mean the primary property photo; “conversion” can refer to document-shape conversion; “enquiries” occurs in required disclaimers and rental brochure descriptions; “property pages” can refer to external listing sites being scraped. In particular, keep compliance wording in `lib/lease-appraisal/leaseAppraisalDisclaimer.ts`, `lib/sales-appraisal/deriveSalesAppraisalCopy.ts`, and brochure disclaimers. `lib/openai/generateReportCopy.ts` and `lib/scraping/rea/reaUrlMatch.ts` are not CRM features.

## Execution sequence

1. **Establish compatibility boundaries.** Inventory existing hosted property pages, custom destinations, published report/collateral QR assets, lead counts, and recent redirect usage without changing production data. Decide which legacy pages stay eligible, retention of enquiry history without product access, and when legacy forms stop accepting submissions. Keep a restorable source revision and retain the database/storage records.
2. **Introduce document-owned link settings.** Add one shared destination contract for reports and collateral, explicit no-QR behaviour, server validation, and published snapshot metadata. Preserve legacy documents with absent new fields. Add the control to each supported creation workflow and supply per-output defaults for automated generation.
3. **Decouple generation.** Replace listing-wide QR provisioning in report/collateral generation, copy regeneration, publishing, and headless jobs. Ensure brochures need a property but do not require a QR. Preserve choices across edits and require republishing to update a document's PDF.
4. **Retire the CRM interface and automatic page creation.** Remove navigation, dashboard analytics, workspace metrics/tabs/cards, library lead counts, and normal template controls. Remove every implicit provisioning caller. Apply explicit eligibility and lead-capture rules to public routes and APIs. Update marketing/settings copy at the same time.
5. **Verify on a preview with mocked data.** Exercise the cases below individually and record results. Review PDFs as well as HTML. Do not rely on the old lint harness alone to validate the new behaviour.
6. **Roll out with legacy compatibility intact.** Promote only after the preview checks pass. Smoke-test existing links and report publication. Retain historical code/data; physical deletion and a final shutdown of old URLs are separate later decisions.

## Acceptance checks

| Scenario | Expected result |
| --- | --- |
| Create, scrape, edit, and open a new property | No automatic hosted page/QR provisioning, lead queries, or CRM UI. Property data and report creation still work. |
| Publish an STR report, lease appraisal, sales appraisal, sales brochure, and rental brochure with QR off | Successful publication and PDF generation; no orphan QR image, empty QR box, or scan instruction. |
| Make two reports for the same property, one with no QR and another with a custom URL | Independent choices and output. The second report's QR decodes to its chosen destination. |
| Give two documents on the same property different destinations | Each QR reaches its own destination; changing the listing URL does not change either. |
| Choose the online version of a report | QR reaches that report's public viewer, without creating a property enquiry page. |
| Regenerate copy or change images, estimate, template, or agent details | The document's saved destination choice survives; unrelated documents and published snapshots remain stable. |
| Change a new document's destination after publication | Requires an intentional republish/PDF refresh; existing downloaded PDFs keep the direct destination they encoded. Legacy listing redirects retain their separate compatibility behaviour. |
| Business card with QR off/on/custom URL | Optional QR works independently of property-page availability. |
| Scheduled delivery and manual outreach, including an appraisal-only bundle | Each output respects its setting/default; shared preparation does not create a property page. No messages are sent during mocked preview tests. |
| Existing published report/PDF, property-page URL, and printed listing QR | Continue to render/resolve under the documented legacy policy. Missing new metadata does not remove old QR assets. |
| Direct visits or API submissions for an ineligible new property | Cannot bypass the retired feature by knowing a slug or calling an API directly. |
| Retired enquiries | No Settings/history entry; authenticated `/leads` returns 404. Retired form behaviour is enforced at the API as well as in the page. |
| Every affected report/brochure template family | Layout reviewed with QR on and off, including shared closing sections and correct destination wording. |

Run relevant unit/integration coverage, lint, and a production build after implementation. Use preview browser tests and actual QR decoding/PDF inspection for output behaviour. The inventory above is the original execution plan; completed implementation and test boundaries follow.

## Implementation — 9 October 2026

The approved report-first design is implemented. `LEGACY_PROPERTY_PAGE_TOOLS` disables the old product controls and write paths while retaining their source. Legacy page eligibility requires stored publication/destination evidence; a new property's required slug alone is insufficient. Public forms are replaced with agent contact details. Following the user’s request to remove previous enquiries, the history entry is removed from Settings and the old enquiries page returns 404. Stored records and source remain untouched. Neither history, migrations nor stored QR/PDF assets are deleted. Read-only inventory before implementation found 232 properties, 222 provisioned pages, one custom property destination, three historical enquiries, and 75 report QR assets; no production records were changed.

Document settings live in the existing report/collateral JSON. `document_link` records the published choice; `document_link_draft` holds a pending choice and its generated asset until explicit publication. Public/print routes remove draft metadata from client props. New documents default to `none`; reports additionally support their own online report and custom URLs, while brochures/cards support custom URLs. Cards apply their setting on save. New assets have unique names and encode the selected URL directly. Older metadata-free documents retain their existing asset. Copy rebuilding and headless STR/lease/brochure generation preserve or explicitly apply the document's choice.

The original implementation is recoverable in Git at revision `89a4912`. Re-enabling the flag alone is not a complete rollback: new per-document choices and removed automatic callers must be considered together. Restore selected old UI/callers in a reviewed change without deleting the newer JSON fields or changing already printed QR destinations. No schema rollback is needed.

### Validation scope

Automated tests use synthetic records and mocked service boundaries. Later, the user authorised live testing with temporary QA records in the shared database. Actual estimate, copy, storage and Browserless calls were exercised; all temporary QA listing/report/collateral records were archived. No existing customer records were edited or delivery messages sent. The remaining manual-listing appraisal limitation and detailed results are recorded in `docs/report-tool-validation.md`.
