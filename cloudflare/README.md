# Full application migration — 9 November 2026

Workers Paid is activated. The application runs using vinext 1.4.4 on Workers,
with placement near the existing Tokyo Supabase database. Public reports retain
their smaller, separate Worker. Supabase remains the source of truth; Browserless
renders PDFs and SVG logos; R2 stores public images and private documents.

The production deployment fixes the Free trial blockers below:

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

From the migration worktree with Node 24:

```sh
STAYPACK_DEV_PORT=3102 node scripts/container.mjs exec app npm run build:cloudflare
npm run deploy:cloudflare
```

`wrangler.app.jsonc` is production; root `wrangler.jsonc` is private QA. Both builds
remove generated dotenv files and scan artifacts for embedded private values.
Deploy uses encrypted Worker secrets from the existing local environment, passed
through a temporary mode-0600 file which is removed afterwards. No secrets belong
in Git. The production workers.dev hostname and preview URLs are disabled;
normal access is only through `staypack.app`. There is no automatic Git deployment
configured for the app: use the checked build and deployment commands above.

Before retirement, rollback is removal of the two `staypack-app` routes, leaving
all six `staypack-public-reports` routes intact. Netlify's known-good deployment is
`6087f47` / `6af17f05327228e2745187d1`. After retirement, restore that deployment and
its two maintenance schedules before routing traffic back; disable Cloudflare
maintenance first. Database and storage formats are unchanged by this migration.

## Paid preview validation

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

## Production cutover and retirement

`staypack.app` is served by `staypack-app` version
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

---

## Archived Free-plan evaluation

# Public report hosting

The report Worker serves `/examples/*`, `/example/*`, `/proposal/*`, the hashed
viewer assets, fonts and brand assets on `staypack.app`. The existing Netlify
application remains the origin for dashboard, APIs, jobs and private print
rendering. `/proposal/print/*` passes through to that origin. This is a standalone
Worker built from the shared report reader and renderer, without a Next runtime.

The Worker uses a placement hint near `aws:ap-northeast-1`, matching the primary
database in Tokyo. This avoids repeated intercontinental database round trips;
static assets still run nearest to visitors. If the primary database moves,
update this hint and repeat regional timing and revocation checks. Do not point
it at a replica to avoid the primary access check.

The Worker uses the primary Supabase project `qmtfugaeujeikyegoxwi`. Every report
request checks live publication, revocation and archive state before reading a
snapshot. Only immutable snapshots use the bounded in-memory cache. Report HTML,
redirects and errors are always no-store; Workers response caching is explicitly
disabled. Database fetches use `cache: "no-store"`: Cloudflare does not support
Next's `force-cache` network hint. The internal snapshot cache consumes that hint
before the network adapter strips it. Never authorize against a replica or serve
cached content when the primary check fails.

The client logo and primary colour are rendered inline before the viewer styles
and script load. Hashed viewer assets cache for one year; report contents never
enter the static asset directory. Runtime secrets are not compiled into bundles.

## Deploy

Use Node 24, with the normal Docker checks:

```sh
docker compose exec app npm run build:report-worker
docker compose exec app npx vitest run lib/public-delivery
docker compose exec app npx tsc --noEmit
docker compose exec app npx wrangler@4.158.0 deploy --config cloudflare/wrangler.jsonc --dry-run
```

An authorized Cloudflare deployment identity must belong to the account hosting
StayPack. The Worker requires two encrypted runtime secrets:
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Set these with
`wrangler secret bulk --config cloudflare/wrangler.jsonc` using protected stdin;
never put their values in the config, a shell argument, Git, or build output.
For local testing only, `cloudflare/.dev.vars` is ignored by Git.

After the secrets and account are verified, deploy with `npm run deploy:report-worker`.
This command builds the matching viewer assets and Worker together. A regular
Netlify Git deploy does not update this Worker: changes to report components,
shared published readers, fonts or brand assets must also deploy the report
Worker. Keep that step in the release workflow until Cloudflare Git builds are
connected. Pin Wrangler for reproducible deployments.

Check `X-StayPack-Delivery: cloudflare-edge`, the edge location and `Server-Timing`.
Use fresh browser contexts and regional probes for Sydney, Melbourne, Los Angeles
and New York. Verify branding with delayed CSS, page navigation, anonymous
dashboard redirects, and private print authorization. Warm a disposable report,
revoke it, and verify 404 responses without report data from the same regions.
Test token revocation, pinned-version revocation and archived reports as well.
Remove the disposable database rows afterwards.

To roll back, remove this Worker's six routes in Cloudflare. The matching Netlify
report reader remains available and performs the same fresh access checks. Keep
report URLs and the primary database unchanged.

## Hosting decision

On 9 November 2026 the original Next response took 6.1 seconds from Sydney and
6.6 seconds from New York. A standalone Netlify edge report handler reduced warm
responses, but regional first requests still took 1.9–4.1 seconds; about 3.3
seconds in Australia occurred before the handler. A roughly ten-minute idle
check still took 2.3–3.2 seconds. Excluding and deferring Next middleware did not
remove this provider startup delay, so the deferred-adapter experiment was
reverted.

Cloudflare Workers is the selected report delivery target. Its isolate runtime
avoids a Node server startup, and the existing domain already uses Cloudflare.
The initial rollout tests the existing Free plan at the owner's request. Monitor
CPU limits and runtime failures during live verification; it allows only 10 ms
CPU per invocation. Workers Paid offers more headroom (US$5/month plus usage
beyond included allowances), but requires a separate approved upgrade. Do not move or
replicate the database merely to improve report delivery: fresh primary checks
are necessary for immediate revocation.

References: [Workers execution model](https://developers.cloudflare.com/workers/reference/how-workers-works/),
[pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[route subrequests](https://developers.cloudflare.com/workers/configuration/routing/routes/),
[supported fetch cache modes](https://developers.cloudflare.com/workers/runtime-apis/request/).

## Live verification — 9 November 2026

Worker version `e620229f-383e-4104-a6ea-9cbf5da8ca95` deployed successfully on
Workers Free with Tokyo placement. Deployment reported 35 ms startup. The first regional requests,
before warming the new deployment, returned HTTP 200 through Cloudflare:

| Probe | First response | Total request | Repeat response |
| --- | ---: | ---: | ---: |
| Sydney | 814 ms | 839 ms | 318 ms |
| Melbourne | 814 ms | 838 ms | 174 ms |
| Los Angeles | 858 ms | 906 ms | 391 ms |
| New York | 845 ms | 878 ms | 212 ms |

Globalping measurement IDs: `2J4hzqJLksp7h41vY00021TEu` (first requests) and
`2Ur7cQPa2nsAEy92L00021TEu` (repeats), using the same four probes as the Netlify
baseline. First response excludes DNS/TCP/TLS setup; total request includes it.
These are point-in-time observations, not latency guarantees.

Fresh browser contexts showed the report in 1.48 seconds on desktop and 1.38
seconds on mobile. Delaying CSS confirmed the Property Providers logo on its
primary blue background, followed by the styled report. There were no browser
errors or horizontal overflow. Anonymous dashboard access redirected to login;
unauthorized private print access and an invalid public token returned 404.

Disposable live database fixtures passed 20 active reads and 12 revocation checks
covering example tokens/canonical URLs, revoked shared links, revoked pinned
versions and archived reports, including RSC requests. The same four regional
probes warmed a fictional example and then all received 404 after revocation
(231–300 ms), with no report data. Fixtures were removed after verification.

Before adding the database placement hint, the Cloudflare deployment returned
first responses in 879–1,320 ms and repeats in 351–1,251 ms. The placement change
reduced the remaining database network delay without changing access checks or
enabling a paid service. See [placement documentation](https://developers.cloudflare.com/workers/configuration/placement/).

Initial aggregate telemetry reported 54 requests, zero runtime errors, 4.14 ms
median CPU and 36.80 ms p99 CPU. The Free plan tolerates occasional overruns but
can terminate sustained CPU use above 10 ms. This functional trial passed; it is
not proof of capacity for every report or traffic level. Monitor `exceededCpu`
and daily requests, and obtain approval before upgrading to Paid. Runtime logs
remain disabled so private report tokens are not retained in request logs.

## Full application Free-plan evaluation — 9 November 2026

**Decision: keep Netlify for the application. This experiment is not ready for a
production cutover.** Public reports continue using the existing production
report Worker. No production routes, database schema, subscriptions or Netlify
deployments changed during this evaluation.

The isolated `codex/cloudflare-app-preview` branch tests vinext 1.4.4 with the
Cloudflare adapter 1.3.3. Cloudflare currently recommends vinext for Next.js apps,
but it is beta. This required React 19.3.1, Vite 8 and Vitest 5, regenerated the
lockfile, and changed the package to ESM. These are experimental toolchain
changes, not a small adapter change to merge wholesale into production.

The private `staypack-app-preview` Worker used the Free plan, no custom routes,
Tokyo placement beside the existing primary database, and a secret access gate.
Billing and delivery endpoints were disabled. Published report routes delegated
to the existing production report Worker, preserving its fresh primary access
checks. The final tested deployment was
`eb42fdab-5543-4351-ab10-293410308348`; its build reported 17 ms startup on the
initial deployment. Startup telemetry is not a browser load-time guarantee.

### Regional timings

Authenticated read-only probes ran from Sydney and US East, verified using
`cf-placement: remote-SYD` and `remote-IAD`. Three rounds alternated target order.
The table shows median complete HTML response time, excluding browser JavaScript
and hydration. See `preview-results.json` for individual samples and first-byte
times. The small sample is directional evidence, not a cold-start guarantee.

| Probe | Page | Netlify | Cloudflare preview |
| --- | --- | ---: | ---: |
| Sydney | Dashboard | 2,301 ms | 460 ms |
| Sydney | Editor | 3,221 ms | 387 ms |
| Sydney | Login | 546 ms | 280 ms |
| US East | Dashboard | 1,754 ms | 1,725 ms |
| US East | Editor | 3,329 ms | 1,007 ms |
| US East | Login | 124 ms | 391 ms |

US first-byte times were worse for the preview dashboard (1,570 vs 197 ms) and
editor (811 vs 309 ms), even where the complete response improved. Database
distance and request work remain relevant. Both report targets already use
Cloudflare, so there was no meaningful report hosting change in this trial.

Local browser tests additionally loaded the editor, selected Check proposal,
opened Edit pages and closed the dialog. Final preview attempts took 2.914 and
2.897 seconds, versus 11.532 and 6.721 seconds on Netlify. Dashboard results
varied: 2.221–3.135 seconds on Cloudflare versus 2.655–3.542 seconds on Netlify.
An earlier preview editor load took 9.924 seconds; this is retained in the raw
results rather than treating the best results as a guarantee. Homepage-to-usable
login navigation took 105–111 ms in the preview and 124–140 ms on Netlify, after
the homepage was ready. These local browser measurements are not regional tests.

Fast streamed HTML exposed clicks arriving before editor step handlers were
ready. `AppraisalWizardNavigation` now disables those controls until hydration.
The final interaction checks and functional checks passed after this fix.

### Functional results and blockers

Passed: anonymous redirects, login return URL, editing and saving across tabs
and reloads, stale-save conflicts, cross-agency read/write denial, mobile layout,
and immediate access denial after membership removal. A warmed report returned
404 immediately after revocation on both preview and production; subsequent
Sydney and US East requests returned 404 without report data on both targets.

Three issues prevent replacing Netlify:

1. **Free CPU headroom:** sampled telemetry across 92 requests showed 31.387 ms
   median CPU, 271.324 ms p95 and 437.687 ms p99, against Free's 10 ms allowance.
   There were no Worker runtime exceptions in that sample, but handled 502/503
   application errors occurred below. Successful requests above the allowance
   do not establish reliable Free-plan capacity. Network waiting is not CPU.
2. **Publishing:** the real publish endpoint returned 503 because the native
   Sharp image module cannot load in the Workers runtime. Existing published
   links stayed unchanged. Image preservation needs a compatible implementation;
   end-to-end PDF creation was not verified after this publishing failure.
3. **Background jobs:** lease and sales job-start endpoints returned 502 because
   their Netlify background dispatch has not been replaced by a durable
   Cloudflare queue consumer. Diagnostic direct runner tests passed completed-job
   idempotency and persisted failures for missing inputs. They do not validate
   durable execution, retries, scheduling or successful provider enrichment.

No paid provider enrichment, billing or customer delivery was exercised. Paying
for more CPU alone would not fix image processing or background job dispatch.
A future migration needs those implementations plus repeated end-to-end,
regional and revocation checks before any production routing change.

### Validation and cleanup

The production preview build, TypeScript check and changed-file lint passed.
The full unit suite passed 2,357 tests with six skipped before the hydration
guard. The guard and related editor/preview boundary checks then passed all 12
focused tests, followed by a fresh build, deployment and live verification.

All disposable users were signed out and deleted. Their agencies, memberships,
listings, reports, versions, links and jobs were confirmed removed. Both regional
probe Workers were deleted. The app preview's workers.dev and version preview
URLs are disabled, and its access secret and database service-role secret were
removed. Production's six report routes were verified unchanged. No paid plan
was enabled. The preview is deliberately offline after evaluation.

To reproduce in an isolated worktree using Node 24:

```sh
STAYPACK_DEV_PORT=3102 npm run container:up
STAYPACK_DEV_PORT=3102 npm run container:status
STAYPACK_DEV_PORT=3102 node scripts/container.mjs exec app npm run build:cloudflare-preview
```

Use `build:cloudflare-preview` rather than the raw Vite build. It checks the exact
preview account/name, rejects production routes, verifies the Supabase project,
removes the adapter's generated `dist/server/.dev.vars`, and scans deployable
files for private environment values. Supply runtime secrets through protected
Wrangler input; never commit them. Deployment uses `dist/server/wrangler.json`.
Re-enable only this private preview for a new trial, with fresh disposable
accounts and a fresh access key. Never connect this branch to production Git
deploys or attach `staypack.app` routes while the blockers remain.

References: [Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/),
[Free limits and CPU accounting](https://developers.cloudflare.com/workers/platform/limits/),
[placement verification](https://developers.cloudflare.com/workers/configuration/placement/).
