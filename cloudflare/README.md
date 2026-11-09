# Public report hosting

The report Worker serves `/examples/*`, `/example/*`, `/proposal/*`, the hashed
viewer assets, fonts and brand assets on `staypack.app`. The existing Netlify
application remains the origin for dashboard, APIs, jobs and private print
rendering. `/proposal/print/*` passes through to that origin. This is a standalone
Worker built from the shared report reader and renderer, without a Next runtime.

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
