import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const accountId = 'fc594f30144c9ba2a1cb9a5c3ce1313a';
export const repository = 'Cammercer1/staypack';
export const workersDomain = 'cameronmercer1991.workers.dev';
export function validateSha(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Expected a full Git commit SHA');
  return sha;
}
export function previewName(branch) {
  if (!branch || branch === 'main' || branch.length > 250) throw new Error('Expected a non-production branch');
  return `staypack-prv-${createHash('sha256').update(branch).digest('hex').slice(0, 16)}`;
}
export function previewConfig(branch, sha, root = process.cwd(), built = false) {
  const name = previewName(branch), origin = `https://${name}.${workersDomain}`;
  return {
    name, account_id: accountId, compatibility_date: '2026-11-09', compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
    main: resolve(root, built ? 'dist/server/index.js' : 'cloudflare/branch-preview-entry.ts'),
    assets: { directory: resolve(root, 'dist/client'), binding: 'ASSETS', html_handling: 'none', not_found_handling: 'none', run_worker_first: true },
    workers_dev: true, preview_urls: false, routes: [], send_metrics: false, observability: { enabled: false }, cache: { enabled: false },
    limits: { cpu_ms: 30000 },
    vars: { CLOUDFLARE_APP: '1', APP_ENV: 'preview', STAYPACK_BRANCH_PREVIEW: '1', STAYPACK_REGRESSION_PREVIEW: '1', BILLING_MODE: 'disabled',
      SITE_URL: origin, NEXT_PUBLIC_SITE_URL: origin, NEXT_PUBLIC_REPORTS_URL: origin,
      NEXT_PUBLIC_SUPABASE_URL: 'https://preview.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-preview-no-database', RELEASE_SHA: validateSha(sha) },
    ...(built ? { no_bundle: true, rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }] } : {}),
  };
}
export async function productionConfig(sha, root = process.cwd(), artifactRoot = root) {
  const config = JSON.parse(await readFile(resolve(root, 'wrangler.app.jsonc'), 'utf8'));
  if (config.name !== 'staypack-app' || config.account_id !== accountId) throw new Error('Unexpected production worker');
  return { ...config, main: resolve(artifactRoot, 'dist/server/index.js'), no_bundle: true,
    rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
    assets: { ...config.assets, directory: resolve(artifactRoot, 'dist/client') },
    vars: { ...config.vars, RELEASE_SHA: validateSha(sha) }, keep_vars: true };
}
