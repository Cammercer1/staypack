# Cloudflare hosting and operations

The whole production web app runs on Cloudflare Workers Paid at
`https://staypack.app`. Netlify is disabled; it is retained only for an explicit
recovery, not used for normal requests, jobs, previews or deployments.

| Component | Current owner | Configuration |
| --- | --- | --- |
| Homepage, login, dashboard, editors, APIs, private print | `staypack-app` Worker | [`wrangler.app.jsonc`](../wrangler.app.jsonc) |
| Published reports and viewer assets | `staypack-public-reports` Worker | [`wrangler.jsonc`](wrangler.jsonc) |
| Lease/sales enrichment | `staypack-appraisals` Queue; `staypack-appraisals-dead` dead-letter queue | App Worker producer/consumer bindings |
| Billing sync and cache cleanup | App Worker Cron Trigger | [`scheduled.ts`](scheduled.ts); billing remains disabled |
| Database, Auth and RLS | Existing Supabase project `qmtfugaeujeikyegoxwi` | [Database guide](../supabase/README.md) |
| File storage; PDF rendering | Cloudflare R2; Browserless | App runtime secrets |

Read [ENVIRONMENT.md](ENVIRONMENT.md) before changing secrets or build variables,
and [CI.md](CI.md) for automatic tests, private previews and deployments.

## Full application migration — 9 November 2026

Workers Paid is activated. The application runs using vinext 1.4.4 on Workers,
with placement near the existing Tokyo Supabase database. Public reports retain
their smaller, separate Worker. Supabase remains the source of truth; Browserless
renders PDFs and SVG logos; R2 stores public images and private documents.

The production deployment fixes the Free trial blockers recorded in
[HISTORY.md](HISTORY.md):

- Raster metadata uses pure JavaScript. Isolated Browserless screenshots convert
  SVG logos; permanent image copies remain content-addressed and checked on readback.
- Workers image downloads use public fetch with bounded redirects, time and bytes.
  Node deployments retain DNS-pinned sockets. Workers enables
  `global_fetch_strictly_public` and has no private-network bindings.
- Next cache hints are translated into the existing bounded immutable-snapshot
  cache. Authorization/revocation reads remain `no-store` on every request.
- Lease and sales enrichment uses Cloudflare Queues with retries, a dead-letter
  queue, agency checks and compare-and-swap job claims. Replaying completed jobs
  does not run provider enrichment again.
- The production app owns `/proposal/print/*` explicitly, ahead of the report
  Worker's wider `/proposal/*` route. PDF rendering must never fall back to Netlify.
- Billing sync retains its one-minute cadence and cache cleanup its five-minute
  cadence. `SCHEDULES_ENABLED=1` was deployed after Netlify was disabled.
  The old delivery-cron declaration had no deployed function; no new customer
  email schedule is enabled by this migration.

The existing billing mode remains disabled. Migration does not activate Stripe
billing or send customer delivery messages. Runtime dependencies have no high or
critical audit findings; lower-severity transitive findings remain in vinext's
image-generation/development tooling. vinext is still beta, so keep the pinned
versions and run the live release checks for framework upgrades.

## Build, deploy and rollback

The normal release path is now branch → passing GitHub checks → merge to `main`
→ automatic deployment of both Workers. Private branch previews use synthetic
data and have no hosted database or jobs. See [CI.md](CI.md) for details.

For an authorized manual recovery, from a worktree with Node 24:

```sh
STAYPACK_DEV_PORT=3102 node scripts/container.mjs exec app npm run build:cloudflare
npm run deploy:cloudflare
```

`wrangler.app.jsonc` is production; root `wrangler.jsonc` is legacy private QA,
not the automatic branch-preview configuration. Builds remove generated dotenv
files and scan artifacts for embedded private values. The manual app deploy
uploads allowlisted local secrets and can overwrite newer Cloudflare values;
check [environment ownership](ENVIRONMENT.md) first. Normal CI preserves runtime
secrets without uploading `.env.local`. Production workers.dev hostnames and
version preview URLs are disabled; normal access is through `staypack.app`.

Shared report-reader/renderer changes need the matching public-report deployment:
`npm run deploy:report-worker`. Normal CI deploys both Workers together and checks
the resulting release. Manual recovery must also verify login, authenticated
dashboard/editor access, report delivery and revocation, and PDFs when affected.

For a code regression, revert the merge through a passing PR or restore the
previous compatible Cloudflare Worker versions. CI records previous versions and
automatically restores them if its deployment smoke checks fail. Neither approach
reverts database migrations or external effects.

Netlify fallback requires an explicit recovery: restore and verify its known-good
deployment (`6087f47` / `6af17f05327228e2745187d1`) **before** removing app routes.
Coordinate maintenance so Cloudflare and Netlify do not run duplicate schedules;
keep all six public-report routes intact. Simply removing the app routes while
Netlify is disabled breaks the app. Database and storage formats were unchanged
by the hosting migration; assess compatibility with any subsequent migrations
before using this older fallback.

## Paid preview validation — 9 November 2026

2,373 unit tests passed (six opt-in live tests skipped); TypeScript passed and
ESLint reported no errors. Separate live tests verified login, saved editor
changes, conflicts, cross-agency denial, membership removal and immediate warmed
report revocation. Both real provider jobs completed (28 lease and 30 sales
comparables), including an automatic retry. Production queue dispatch also
completed; four repeated completed-job messages left attempt counts unchanged.
Legacy and current-template PDFs generated, downloaded and rendered successfully.

Three rounds of probes placed in Sydney and US East measured complete HTML,
not browser hydration. Individual results are in `paid-preview-results.json`.

| Probe | Page | Netlify median | Cloudflare median |
| --- | --- | ---: | ---: |
| Sydney | Dashboard | 2,619 ms | 1,286 ms |
| Sydney | Editor | 4,119 ms | 884 ms |
| Sydney | Login | 15 ms | 619 ms |
| US East | Dashboard | 1,782 ms | 539 ms |
| US East | Editor | 3,087 ms | 538 ms |
| US East | Login | 259 ms | 413 ms |

Direct login HTML is slower than Netlify's static CDN response. Homepage-to-usable
login navigation was 56–83 ms in local browser checks because the form is
prefetched. Local dashboard readiness was 0.91–1.23 seconds and interactive editor
readiness 2.57–2.66 seconds. These are small samples, not latency guarantees.
Public reports already ran on Cloudflare and therefore show no hosting improvement
in this comparison. Production cutover verification is recorded separately below.

## Production cutover and retirement — 9 November 2026

At cutover, `staypack.app` was served by `staypack-app` version
`7361e535-c1f5-444f-bbbb-c5fc5e9bb093` (the tested code from
`cc2531ce-a4d2-4350-995c-5dfde3331e8b`, with the temporary candidate access secret
removed). The two production app routes and six
public-report routes are intact. The final editor fix prevents step navigation
until saved proposal data has loaded; 57 focused tests passed after that fix.
The existing four storage-cleanup tests also passed.

Netlify was kept live through candidate validation and production verification,
then disabled reversibly, with auto publishing locked to `6087f47`. Its US$9
Personal plan is confirmed scheduled to downgrade to Free on 27 November 2026.
Cloudflare Workers Paid has a US$5/month base fee plus usage above its allowance;
existing database, storage and external-service costs are separate. Netlify's
project and known-good deployment remain available for an explicit rollback.

A fresh Browserless PDF generated successfully after Netlify was disabled:
HTTP 200, 294,284 bytes, valid PDF signature. Authenticated dashboard and editor,
login, and the Property Providers example still returned 200. Warmed current and
version-specific report URLs plus PDF downloads returned immediate no-store 404s
after revocation, without private report text. Regional revocation checks also
passed in Sydney and US East. The inline loader displayed the client's logo and
primary blue background, with no StayPack branding.

Cloudflare cron events at 09:30–09:34 UTC completed with no exceptions, including
the five-minute cache-cleanup boundary. Billing mode remains disabled, matching
the previous deployment. Disposable users, agency rows, report files, private
preview Worker, two probes and preview queues were removed. Production routes
and queues were verified unchanged after cleanup.

Final production complete-HTML medians (three requests per region/page):

| Probe | Page | Netlify | Cloudflare production |
| --- | --- | ---: | ---: |
| Sydney | Dashboard | 2,619 ms | 487 ms |
| Sydney | Editor | 4,119 ms | 724 ms |
| Sydney | Login | 15 ms | 179 ms |
| US East | Dashboard | 1,782 ms | 472 ms |
| US East | Editor | 3,087 ms | 809 ms |
| US East | Login | 259 ms | 311 ms |

These measure complete HTML, not browser readiness. Local production browser
checks reached a usable dashboard in 0.98–1.92 seconds and opened the editor's
Edit pages dialog in 3.96–4.05 seconds. Homepage-to-usable-login navigation took
89–96 ms with prefetching. Direct login HTML remains slower than Netlify's static
CDN response. No latency guarantee is implied by these small samples.

See `production-results.json` for sanitized evidence. There is no remaining
application dependency on an enabled Netlify site. The underlying proxied DNS
origin is retained for rollback, and the separate report Worker's historical
print fallback is overridden by the explicit production print route. Do not
remove that route during routine deployments.

The subsequent GitHub workflow rollout deployed commit
`01e942b89d447e6e8687bff2de3c8fba3666068b` through
[CI](https://github.com/Cammercer1/staypack/actions/runs/42600398954) and
[deployment](https://github.com/Cammercer1/staypack/actions/runs/42600950161).
Private-preview browser checks, production smoke checks and branch-deletion
cleanup passed. These are dated verification records; use GitHub Actions and the
live `X-StayPack-Revision` response header on `/login` for the current revision.


## Earlier evaluations

The report-only migration and whole-app Free-plan trials are preserved in
[HISTORY.md](HISTORY.md). Their Netlify and temporary-candidate instructions are
superseded by the production setup above.
