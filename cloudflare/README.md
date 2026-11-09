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
