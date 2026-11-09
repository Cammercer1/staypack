import { appendFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { accountId, previewConfig, productionConfig, repository, validateSha, workersDomain } from './config.mjs';
import { validateSourceRun, validateManifest } from './validation.mjs';

const root = process.cwd(), artifact = resolve(process.env.RELEASE_DIRECTORY || 'ci-release');
const sha = validateSha(process.env.CI_SHA), branch = process.env.CI_BRANCH;
const production = branch === 'main';
if (process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Deployments must run from the trusted main workflow');
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.GITHUB_TOKEN) throw new Error('Missing protected deployment credentials');
async function github(path, method = 'GET', body) {
  const r = await fetch(`https://api.github.com/repos/${repository}/${path}`, { method, headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub ${method} ${path.split('?')[0]} failed (${r.status})`);
  return r.json();
}
const run = await github(`actions/runs/${process.env.CI_RUN_ID}`);
validateSourceRun(run, sha, branch);
const head = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
if (head.object.sha !== sha) { console.log('A newer branch commit exists; skipping this deployment.'); process.exit(0); }
const manifest = JSON.parse(await readFile(join(artifact, 'release.json'), 'utf8'));
validateManifest(manifest, sha, branch);
// Treat downloaded branch output as data. Never execute its package/build scripts,
// trust its Wrangler config, or use its files as shell command arguments.
for (const entry of await readdir(artifact, { recursive: true, withFileTypes: true })) {
  if (entry.isSymbolicLink() || /^(?:\.env|\.dev\.vars)/.test(entry.name)) throw new Error('Unsafe artifact entry');
}
async function cloudflare(path, method = 'GET', body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, { method, headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(`Cloudflare ${method} failed (${r.status})`);
  return data.result;
}
const work = await mkdtemp(join(tmpdir(), 'staypack-ci-deploy-'));
async function deploy(config, name, secrets) {
  const path = join(work, `${name}.json`);
  await writeFile(path, JSON.stringify(config));
  const args = ['--yes', 'wrangler@4.158.0', 'deploy', '--config', path, '--no-bundle', '--message', `GitHub ${sha}`, '--no-autoconfig'];
  if (secrets) { const secretPath = join(work, 'secrets.json'); await writeFile(secretPath, JSON.stringify(secrets), { mode: 0o600 }); args.push('--secrets-file', secretPath); }
  const code = await new Promise((accept, reject) => { const child = spawn('npx', args, { cwd: work, env: process.env, stdio: 'inherit' }); child.on('error', reject); child.on('close', accept); });
  if (code !== 0) throw new Error(`Deployment failed: ${name}`);
}
const config = production ? await productionConfig(sha, root, artifact) : previewConfig(branch, sha, artifact, true);
const url = production ? 'https://staypack.app' : `https://${config.name}.${workersDomain}`;
const deployment = await github('deployments', 'POST', { ref: sha, auto_merge: false, required_contexts: [], environment: production ? 'production' : config.name, transient_environment: !production, production_environment: production, description: production ? 'Checked Cloudflare application and reports' : 'Private synthetic-data branch preview' });
const status = state => github(`deployments/${deployment.id}/statuses`, 'POST', { state, environment_url: url, log_url: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`, auto_inactive: true });
const previous = [];
try {
  await status('in_progress');
  if (production) {
    for (const name of ['staypack-public-reports', 'staypack-app']) {
      const result = await cloudflare(`/workers/scripts/${name}/deployments`);
      previous.push({ name, versions: result.deployments[0].versions });
    }
    const report = JSON.parse(await readFile(join(root, 'cloudflare/wrangler.jsonc'), 'utf8'));
    if (report.name !== 'staypack-public-reports' || report.account_id !== accountId) throw new Error('Unexpected report worker');
    report.main = join(artifact, 'report/worker.js'); report.assets.directory = join(artifact, 'report/assets'); report.no_bundle = true;
    report.vars = { RELEASE_SHA: sha };
    await deploy(report, 'reports');
    await deploy(config, 'application');
  } else {
    if ((process.env.BRANCH_PREVIEW_ACCESS_KEY || '').length < 32) throw new Error('Missing private preview access secret');
    await deploy(config, 'preview', { BRANCH_PREVIEW_ACCESS_KEY: process.env.BRANCH_PREVIEW_ACCESS_KEY });
  }
  const headers = production ? {} : { 'x-staypack-preview-key': process.env.BRANCH_PREVIEW_ACCESS_KEY };
  let healthy = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url + (production ? '/login' : '/__preview/health'), { headers, redirect: 'manual' });
    await response.arrayBuffer();
    if (response.status === 200 && response.headers.get('x-staypack-revision') === sha) { healthy = true; break; }
    await new Promise(accept => setTimeout(accept, 4000));
  }
  if (!healthy) throw new Error('The deployed revision did not pass its health check');
  if (!production) {
    for (const path of ['/', '/dev/branch-preview', '/_next/static/missing.js', '/__preview/health']) {
      if ((await fetch(url + path, { redirect: 'manual' })).status !== 401) throw new Error('Preview privacy check failed');
    }
    for (const path of ['/api/str/estimate', '/api/delivery/cron', '/proposal/private', '/dashboard']) {
      if ((await fetch(url + path, { headers })).status !== 404) throw new Error('Preview isolation check failed');
    }
    const page = await fetch(url + '/dev/branch-preview', { headers });
    if (page.status !== 200 || !(await page.text()).includes('Private branch preview')) throw new Error('Preview UI failed');
  } else {
    const report = await fetch(url + '/examples/property-providers/6-33-malvern-avenue-manly');
    if (report.status !== 200 || report.headers.get('x-staypack-delivery') !== 'cloudflare-edge') throw new Error('Public report smoke check failed');
    if ((await fetch(url + '/dev/branch-preview')).status !== 404) throw new Error('Preview screen exposed on production');
    const privatePage = await fetch(url + '/dashboard', { redirect: 'manual' });
    if (![302, 303, 307, 308].includes(privatePage.status) || !privatePage.headers.get('location')?.includes('/login')) throw new Error('Production authentication smoke check failed');
  }
  await status('success');
  console.log(`Verified ${production ? 'production' : 'private preview'}: ${url}`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Verified ${sha}\n\n[${production ? 'Production' : 'Private synthetic preview'}](${url})\n\n${production ? 'Application and report Workers deployed together.' : 'Username: preview. Password is held separately by the owner. No customer database, jobs or provider keys.'}\n`);
} catch (error) {
  if (production && previous.length === 2) {
    for (const saved of previous.reverse()) await cloudflare(`/workers/scripts/${saved.name}/deployments`, 'POST', { strategy: 'percentage', versions: saved.versions, annotations: { 'workers/message': `Rollback failed release ${sha}` } });
    console.error('Restored the previous application and report versions.');
  } else if (!production) {
    await cloudflare(`/workers/scripts/${config.name}`, 'DELETE').catch(() => {});
  }
  await status('failure');
  throw error;
} finally { await rm(work, { recursive: true, force: true }); }
