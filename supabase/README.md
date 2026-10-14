# Supabase setup

Run these steps after creating your Supabase project.

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run every file in `migrations/` in numeric order (`001` through `018`, etc.).
   - If social posts or rental brochure fail with `collateral_items_type_check`, run [`migrations/018_collateral_types_rental_social.sql`](migrations/018_collateral_types_rental_social.sql).
3. Enable the Email auth provider in Authentication → Providers.
4. Copy project URL, anon key, and service role key into `.env.local`.
5. Set local URLs:
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
   - `NEXT_PUBLIC_REPORTS_URL=http://localhost:3000`
   - `QR_CODE_BASE_URL=http://localhost:3000`

Optional later (step numbers above assume full migration run):

- Add `OPENAI_API_KEY`
- Add `AIRROI_API_KEY` for new STR estimates. Existing Airbtics reports remain readable.
- Add `BROWSERLESS_API_KEY` and `BROWSERLESS_BASE_URL`
- Add `GOOGLE_MAPS_API_KEY`

New STR estimates require `AIRROI_API_KEY` in the server environment. Without copy/PDF keys, development mode returns mock copy/PDF data. The development regression preview supplies synthetic estimates for UI testing.

## Migration history

The original numbered migrations were installed through the SQL editor. Do not
blindly replay them on the existing production database with `db push`; its CLI
history is not a baseline of those older installations.

The 9 October 2026 agent directory and separate property price migrations are
already applied and recorded in production. Their filenames match the recorded
versions. Deploying the application does not run migrations automatically.

The 10 October 2026 AirROI compatibility migration
[`20261010080940_allow_airroi_estimates_without_airbtics_tier.sql`](migrations/20261010080940_allow_airroi_estimates_without_airbtics_tier.sql)
is applied and recorded in production. It makes `reports.airbtics_tier` nullable
and removes its legacy default, preserving historical values and the summary/full
check. The production schema was verified with an AirROI metadata update on a
temporary copy of a report, rolled back without changing live report data or
calling the estimate provider.

[`20261010083434_add_company_str_management_presets.sql`](migrations/20261010083434_add_company_str_management_presets.sql)
is also applied and recorded in production. It adds the company preset JSON array
to `agencies`; existing agencies start with no presets. A save was verified on a
temporary table in a rolled-back transaction, with agency RLS confirmed enabled.
The application writes presets through the existing agency-admin access check
and scopes updates to that admin's agency. No existing report is modified.

## Short-Term Rentals workspace

[`20261010232632_str_appraisal_workspace.sql`](migrations/20261010232632_str_appraisal_workspace.sql)
is applied to the existing StayPack project, which is shared by production and
the staging preview. This is additive: 150 positively identified STR reports were
registered without rewriting their final report JSON, PDF URLs or public links.
Compatibility triggers register STR reports created by the previous app version
while the new workspace is evaluated on staging.

[`20261010233726_str_recipient_conflict_http_status.sql`](migrations/20261010233726_str_recipient_conflict_http_status.sql)
is applied immediately after it. Expected stale edits use `PT409` so PostgREST
returns HTTP 409 instead of retrying an engine serialization error. See
[Supabase's RPC conflict guidance](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

`str_appraisals` adds customer-specific metadata to the existing report. Private
recipient snapshots and reusable `agency_contacts` are protected by agency RLS
and are never merged into public report JSON. Creation and recipient edits use
security-invoker RPCs, with atomic creation, retry-safe request IDs and stale-edit
checks. Existing agencies retain access through the central STR access helper;
subscription gating can be added there later.

The review environment is
[Short-Term Rentals staging](https://str-workspace--staypack.netlify.app/short-term-rentals).
Netlify's `str-workspace` branch context and deploy-preview build context use the
staging site/report URLs with the existing Supabase credentials. Build the preview
with `netlify deploy --context deploy-preview --alias str-workspace`; do not add
`--prod`. Production remains a separate app deploy. Next.js middleware bundling
requires the pinned `@opentelemetry/api` dependency in `package.json`.

The STR editor follows Property & customer → Estimate & evidence → Design &
content → Review & share. Layout selection uses saved estimates; switching layouts
preserves the evidence, wording and photos. Property changes that affect an
estimate return the user to evidence review. No database migration is needed for
this step order. LTR, sales and brochure wizard ordering is unchanged.

Properties and import stay shared. Multiple appraisals can use the same listing;
the existing property-level STR collateral pointer stays stable for brochures.
Archiving an appraisal disables its public report page without deleting the
property or PDFs already downloaded. Restoring does not republish it.

The calculator widget, engagement analytics, messaging and billing remain future
work. This change captures contact details but does not send email or SMS.

Validation:

- `tests/str_workspace_fixture.sql` and `tests/str_workspace_assertions.sql` run
  only in an **empty disposable PostgreSQL 17 database**: fixture, both STR migrations, then
  assertions with `psql -v ON_ERROR_STOP=1`. Never run the fixture on Supabase.
- Unit coverage is in `lib/str-appraisals` and existing report/delivery suites.
- `components/reports/StrJourney.test.tsx` covers ordering, save failures,
  backtracking, template switching and saved-report compatibility.
- `tests/staging/str-step-order.spec.ts` runs the complete desktop/mobile journey
  against `/dev/lint-regression` with synthetic provider responses.
- `tests/staging/str-workspace.spec.ts` is opt-in live browser coverage. Set
  `STR_LIVE_TEST=1`, `STAGING_BASE_URL` and Supabase environment credentials. It
  creates a temporary agency/account, exercises the real API, and removes its
  records. No messages or paid estimate/PDF generation are triggered.
- Supabase advisors report no findings on the added objects. Existing findings
  remain on legacy functions and Auth settings; see the
  [database security advisor](https://supabase.com/dashboard/project/qmtfugaeujeikyegoxwi/advisors/security).

## Digital STR proposal workflow

The main editor at `/short-term-rentals/appraisals/[reportId]` now follows
**Property → Rental appraisal → Proposal → Customer & share**. The old
`/proposal` editor URL redirects there. Legacy non-workspace report flows are
unchanged. The development template studio remains at
`/dev/str-proposal?reportId=...`; it is not the customer authoring interface.

Apply these migrations after the STR workspace migrations, in order:

- `20261012000950_digital_proposal_workspace.sql`
- `20261012002612_digital_proposal_draft_index.sql`
- `20261012020830_digital_proposal_integration.sql`
- `20261012021839_proposal_activity_version_details.sql`

### Account designs and publication

`digital_proposal_assignments` holds one onboarding-owned design per agency and appraisal kind:
`agency_id`, `kind` (`str`, `lease`, or `sales`), `name`, positive integer `version`, and `defaults` (validated by
`proposalDraftSchema`). Provision/update assignments using a trusted server or
admin migration and increment `version` when changing the design. Members can
read the assignment but cannot write it. Without a row, the base template uses
the agency's current brand. New drafts inherit the assigned content/pages;
existing drafts keep their introduction, configured page selection/order, agents,
documents and links. Save and publish enforce the assignment's page definitions,
appraisal heading, renderer, preset, brand, hero and motion settings. Pages can
be added or have their copy changed during brand onboarding; users cannot create
or rewrite pages in an appraisal. Unconfigured text pages cannot be enabled.
The development studio can save experimental settings with
`?studio=1`; publication still uses the account assignment. Additional bespoke
renderers require a registered, versioned renderer in code.

Drafts use revision checks to reject stale saves. Publishing checks the current
property, appraisal, customer and assignment fingerprint. It stores data, brand,
enabled pages and selected documents in an immutable `final_report_json` snapshot.
Identical publication requests reuse the version. Separate
`digital_proposal_links` records allow revocation and a fresh link for the same
version without restoring an old link. Existing links remain on their original
version after edits. Customer email and phone stay private; the customer display
name is included. Up to two active account agents can be attached to a proposal;
their public name, role, photo, phone and email are frozen into the published
snapshot and displayed on Next steps and the PDF. Archived or cross-account agent
IDs are rejected. Agent choices do not change the listing's agents. Public pages
use no-index, no-referrer and no-store headers.

### Documents, agreement links and PDF

Documents are PDFs up to 4 MiB in the private `proposal-documents` bucket. Downloads
require agency access or an active share token whose snapshot includes that
attachment. Files are streamed through the server; no public storage URLs or
reusable signed URLs are exposed. Archiving a listing or appraisal revokes its
versions permanently. Previously downloaded copies cannot be recalled.

**Review & sign** opens the supplied HTTPS signing URL. A click is not a signature
or a completed agreement. Embedded signing, provider callbacks and automated
email/SMS delivery remain future integrations.

Publishing makes the digital link available first, then requests the PDF. A
failed PDF can be retried independently. Browserless renders the same immutable
snapshot through the trusted print renderer; PDFs live in private
`proposal-pdfs` storage and downloads check the active token each time. The
Next steps page exposes **Download proposal PDF** once it is ready. PDF generation
needs the configured Browserless server key; the digital proposal does not.

Havenly's `haven-properties-str` assignment uses its two-page branded PDF. New
publications freeze a separate, validated `pdfReport` in the existing JSON snapshot,
with the same saved appraisal inputs and explicitly selected proposal agents. The
signed `/proposal/print/[versionId]` route renders that version through the existing
Browserless report pipeline. It does not fetch current estimates or agent profiles.
Older publications without `pdfReport` retain their original digital print output;
republish to create a version with the branded PDF. No schema migration is required.

### Activity

Public links record an open, enabled page views, comparison-tab interactions,
visible comparables, document/PDF clicks, and action/agreement clicks. Private
previews and the template studio do not record events. Sessions use a random
per-link browser identifier with 30 minutes of inactivity expiry, not contact
details or fingerprinting. Repeated event targets count once per session;
known bots are excluded and inserts are rate bounded. These are link visits and
interactions, not verified customer identities or proof a document was read.
Forwarded links can contribute activity. Labels are resolved against the exact
published version viewed. The dashboard shows opens; Customer & share includes
the activity breakdown. Signing completion is not inferred from clicks.

### Validation

Run `lib/digital-proposals`, `components/digital-proposals`, and
`components/reports/StrJourney.test.tsx` with Vitest. The opt-in
`STR_LIVE_TEST=1 ... vitest run lib/digital-proposals/integration.live.test.ts`
uses disposable agencies, users, synthetic saved estimates and test files for
isolation, publication, versioning, activity and revocation checks. Add
`STR_PDF_TEST=1` only when intentionally testing real Browserless generation.
Add `STR_HAVEN_TEST=1` to exercise the branded PDF, print-token access and selected
agents using a disposable account with the Havenly template grant.
It removes its own database and storage records. The opt-in Playwright
`tests/staging/str-proposal-workspace.spec.ts` covers the development template
studio and stubs PDF generation. `str-digital-proposal.spec.ts` covers the renderer.
For SQL-only checks, use an empty disposable PostgreSQL 17 database and the
fixtures/assertions in `supabase/tests/`; never run those fixtures on the app DB.

### Published proposal performance

The public viewer uses one uncached inner-join lookup across links, versions,
reports and listings. It verifies matching agency ownership and active status on
every request. It bypasses dashboard session refresh; share tokens remain the
public access boundary. No schema migration is required.

A separate server-side Next Data Cache stores the immutable digital snapshot by
version and content hash for 24 hours. PDF source data is excluded from that
projection. The publication route warms it with `after()`; opening an existing
publication fills a cold cache automatically. The mutable access check and PDF
availability are never cached, and public HTML/download responses remain
`private, no-store`. Do not add `force-dynamic` to the viewer page: that would also
disable its explicitly cached data fetch. Its `no-store` access fetch already
makes the page dynamic. PDFs use only the fresh access lookup before downloading.

The browser paints the branded cover first and shows a preparation indicator for
at most three seconds. Page modules and images use separate queues (two jobs each)
so slow photography does not hold up JavaScript. Included pages render once in
inert, inaccessible offscreen frames at their actual width; charts finish rendering
before navigation reveals them. Fonts and primary images have bounded waits.
Navigation keeps the current page visible until its destination is ready, with
latest-request-wins behaviour and a reload/cancel fallback for failures. Prepared
pages stay mounted, preserving chart tabs and carousel position. Reduced-motion
users receive no reveal animation; data-saving connections prepare only the next
page automatically. Hidden frames never generate page/comparable views, and
preparation never fetches PDFs, attachments or agreement links.

Performance checks should compare cold-browser visits using production builds.
Dev compilation times are not representative. Verify direct section links,
mobile layout, browser history, real interaction tracking, fresh PDF availability,
and revocation/archive behaviour after warming the snapshot cache.

## Detached prospect brands

`20261013045131_detached_prospect_brands.sql` is applied to the shared StayPack database.
Its filename matches the recorded migration version. Prospect brand profiles and example
proposals have no required agency reference, login, membership or billing record. Only
explicitly enrolled internal operators can read their own rows. The private `/prospects`
library is not included in customer navigation. Customer membership alone grants no access.

`/example/[token]` renders the saved public projection; raw imports, provider payloads,
operator details and original selling agents remain private. Examples can be revoked.
Signup is separate: the service-only `attach_prospect_brand` operation atomically applies
branding and management defaults to an existing agency, installs its proposal design and
links the prospect record. It creates no account and leaves shared example snapshots intact.

See `lib/prospects/profiles/README.md` for creation and onboarding commands. The current
creation flow is operator-driven, and the internal library is read-only. This feature is
available on the `prospect-examples` draft deployment; production was not redeployed.

Verification: 21 focused tests and TypeScript/ESLint checks pass. The preview build passed.
Database RLS was exercised using both Cameron's operator identity and the existing Havenly
member identity (zero prospect rows visible to Havenly). Anonymous access and customer
writes/adoption are denied. Supabase security advisors report no findings on the added
objects; pre-existing advisor findings were unchanged.


## Shared rental and sales proposal workspace

`20261014062925_shared_appraisal_workspace.sql` was applied to production on 14 October 2026
so the local shared-appraisal branch can use the existing account and data. The
filename matches the recorded production migration version. All 247 existing
reports retained identical final JSON and status; STR design defaults and versions
also retained identical checksums. The application release uses this existing
migration without reapplying it.

The sidebar exposes all appraisals, short-term rentals, rental appraisals and sales
appraisals. Rental and sales follow Property → Review evidence → Proposal →
Customer & share. The listing library supplies the starting property. Customer
proposals have separate working inputs: changing their photos, description,
figures or comparables does not edit the shared listing or other customers' work.
The existing STR editor, branded renderers, example links and version-1 projection
remain in place. Rental and sales use a typed version-2 projection in the same
publication, attachment, agent-selection, analytics and revocation infrastructure.

The physical `str_appraisals` table is retained for compatibility with existing
report/recipient RPCs and deployed writers. Its `kind`, `inputs_json`,
`input_revision`, `document_json` and `document_revision` columns serve the new
products. `appraisals` is a security-invoker view over that table, with authenticated
read access governed by the underlying agency RLS. Legacy rental/sales reports
are registered and snapshotted by the migration without changing their existing
report JSON. Registration triggers also cover the legacy generation routes.

`create_appraisal` is idempotent per request UUID and rejects reuse for a different
property, kind or recipient. Saves compare the expected timestamp. Enrichment
jobs carry the appraisal ID and source timestamp; workers save only into that
appraisal and fail on conflicting edits. Property changes invalidate evidence via
the existing subject fingerprint. Publishing requires a prepared document at the
current input revision. Existing links can still be viewed/revoked while new
evidence awaits review. PDFs render only the frozen published document through
Browserless, using the existing rental/sales print templates.

Brochure routes, editors and renderers are unchanged. The first appraisal remains
the property's source pointer; subsequent customer appraisals never replace it.
The first prepared document initializes a missing source report once. Later
proposal changes update the separate working document and cannot rewrite an
existing brochure source or historical publication.

Release validation:

- `npm run build` includes navigation regression tests and verifies all 60
  required creation, appraisal, proposal and marketing routes. Missing routes fail the deploy build.
- `npm test`, `npm run lint`, and `npx tsc --noEmit` cover the shared code and the
  existing STR, appraisal and brochure modules.
- Against a disposable backend, opt in with `APPRAISAL_INTEGRATION_TEST=1` and
  `STAGING_BASE_URL` to run `lib/appraisals/workspace.live.test.ts` and
  `tests/staging/appraisal-workspace.spec.ts`. The integration suite seeds synthetic
  evidence and tests actual worker persistence with the provider boundary mocked.
  `APPRAISAL_PDF_TEST=1` additionally exercises the configured Browserless server,
  private storage and PDF download. Never point these fixture tests at production.
- Run `tests/staging/str-workspace.spec.ts` with `STR_LIVE_TEST=1` against the same
  disposable backend to verify the existing STR navigation and publishing journey.

Local migration verification replays the schema, skipping only old data-only
migrations `037`, `040`, `041` that reference production agency UUIDs. Legacy
three-digit migration names contain duplicate versions; local copies receive
unique test-only version numbers. Repository and production history stay unchanged. Migration verification also seeds
legacy STR/rental/sales records before applying the new migration and checks that
their JSON, publication status and STR assignment survive unchanged.

Verification on 14 October 2026: 1,072 unit/component tests passed (two live suites
are opt-in); all three desktop/mobile STR, rental and sales browser journeys
passed against the compiled build. The rental/sales live API suite passed with
agency RLS, stale saves, background-worker conflicts, publication immutability,
revocation/archive, and real local Browserless PDF generation/download. Clean
schema replay, legacy backfill assertions and PostgreSQL schema lint passed.
TypeScript, the production build and both Netlify worker bundles passed. ESLint
reported zero errors and 53 existing warnings. External market evidence was
synthetic; no production records or provider configuration were changed.

### Agency property country

`agencies.country_code` is the account's ISO country code (`AU` or `US`), set during onboarding or in Settings → Agency details. Existing agencies default to `AU`. The existing agency membership and administrator RLS policies govern this field.

Property searches, imports, saved-property selection and appraisal provider calls enforce the account country on the server. Australian accounts use Domain profiles and Australian address suggestions; US accounts use Google Places restricted to the US and Zillow-backed property profiles/comparables. `RAPIDAPI_US_PROPERTY_KEY` is an optional dedicated US provider credential (otherwise the existing RapidAPI key is used).

Report/proposal snapshots store their own country, currency and rent period. US rentals display monthly USD; Australian rentals remain weekly AUD. Existing weekly database amounts remain weekly internally, with conversion at the input/display boundaries. Changing an account country does not rewrite properties, reports or published proposal versions. Add future countries deliberately to the database constraint, validation and provider routing together.


## Embeddable STR calculator

[`20261014104828_str_calculator_widget.sql`](migrations/20261014104828_str_calculator_widget.sql)
is applied to the connected StayPack database. It adds `str_calculator_widgets`
and `str_calculator_leads`; it does not enable calculators for existing agencies.
The application changes still need a deployment before production embeds work.

**Marketing → STR calculator** (`/marketing/str-calculator`) opens on **Leads**.
The **Embed & settings** tab (`?tab=setup`) contains the preview, activation,
market and optional phone settings, and iframe code. Both views are URL-backed;
switching views preserves the lead page and unsaved settings during navigation.
Agency admins select Australia or the United States and activate the calculator.
`/embed/str-calculator/[token]` is public and works without account
cookies. Pausing immediately blocks new submissions; the embed URL stays stable
when settings are saved. The preview uses a labelled sample and creates no leads.
The widget reads current agency colour and font settings on each load.

[`20261014113703_str_calculator_optional_phone.sql`](migrations/20261014113703_str_calculator_optional_phone.sql)
is applied to the connected database. Account admins can turn on **Ask for phone
number** and save settings without activating a paused calculator. It defaults
off; when enabled, **Your details** shows an optional phone field. Submitted phone
numbers appear beside email in the lead list, under the existing agency-member
RLS policy. They are never sent to AirROI or returned in the public estimate.
The reservation RPC strips phone data when the setting is off, including if it
changes while a visitor is completing the form. Existing leads remain unchanged.

Live submissions collect an address, bedrooms, bathrooms, email and explicit contact consent.
The server saves the enquiry, geocodes a complete street address, then calls the
standard AirROI calculator once (no extra market occupancy request, scraping or
report generation). `GOOGLE_MAPS_API_KEY`, `AIRROI_API_KEY` and the Supabase service
role key are required. The selected bathroom count supports half baths and is saved
in `input_json` and used in the estimate. Guests default to `max(2, bedrooms * 2)`,
and the search radius is 2 km; these assumptions are visible
with the estimate. Original input, raw provider response and displayed estimate
are stored separately. Failed estimates retain the enquiry for agency follow-up.

Agency members can read only their own lead projection. Raw provider data and
request fingerprints are service-only. Anonymous clients cannot read either
table or execute the reservation RPC. The RPC uses a row lock, request IDs and
keyed hashes to prevent duplicate paid calls and enforce limits across instances:
100 enquiries per calculator per rolling 24 hours and 5 per client IP per hour.
Only Netlify's trusted connection-IP header is used in production; other runtimes
share an `unknown`/local bucket rather than trusting spoofable forwarded headers.

Verification: `supabase/tests/str_calculator.sql` runs rollback-only database
checks. `docker compose exec app node scripts/verify-str-calculator.mjs` creates
and removes disposable agencies/users to verify settings, lead isolation, public
rendering, replay, and pause behaviour without paid calls or email delivery.
The development-only `/dev/str-calculator` includes sample data; `?view=mobile`
tests a 320 px iframe. Production builds return 404 for this development page.

### Pricing held for later activation

The agreed allowance is 100 completed estimates per account per month, then US$0.50
per additional completed estimate. Charging and monthly billing enforcement are
not enabled in this rollout. Preview results are free and create no usage.
The existing AUD billing catalogue is not changed by this feature deployment.

Production rollout on 14 October 2026: Netlify deploy
`6acf72aaa7c66b4d87780f52`, based on production commit
`63396095f593f8b6f1e892149f4dec141122208a`. The existing production navigation is
preserved, with STR calculator added under Marketing. The live account was
verified on both Leads and Embed & settings; its calculator remains inactive.
The calculator release source is preserved in Git with regression checks for the
existing production navigation and required routes.

For manual Netlify releases, use `netlify deploy --build --context production`
to build and upload the adapter output together, verify the draft's styling and
assets, then promote that exact deploy. A standalone `netlify build` followed by
`netlify deploy --no-build` using `.next` uploads the restored raw Next.js build,
not the adapter's prepared public assets.
