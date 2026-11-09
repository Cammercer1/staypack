import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { previewConfig, validateSha } from './config.mjs';

const branch = process.env.CI_BRANCH, sha = validateSha(process.env.CI_SHA);
if (!branch) throw new Error('Missing CI_BRANCH');
const production = branch === 'main';
const root = process.cwd(), output = resolve(root, 'ci-release');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const config = production ? JSON.parse(await readFile('wrangler.app.jsonc', 'utf8')) : previewConfig(branch, sha);
const configPath = resolve(root, '.wrangler/ci-build.json');
await mkdir(resolve(root, '.wrangler'), { recursive: true });
// Vite resolves relative entries from the config file's directory.
config.main = resolve(root, config.main);
config.assets.directory = resolve(root, config.assets.directory);
await writeFile(configPath, JSON.stringify(config, null, 2));
const publicUrl = production ? 'https://qmtfugaeujeikyegoxwi.supabase.co' : 'https://preview.invalid';
const anonKey = production ? process.env.CI_PRODUCTION_ANON_KEY : 'synthetic-preview-no-database';
if (!anonKey) throw new Error('Missing public production anon key');
// Build subprocesses receive no deployment credentials or server secrets.
const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'CI', 'NODE_OPTIONS'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { STAYPACK_CI_BUILD: '1', STAYPACK_CLOUDFLARE_CONFIG: configPath,
  NEXT_PUBLIC_SUPABASE_URL: publicUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  NEXT_PUBLIC_SITE_URL: production ? 'https://staypack.app' : config.vars.SITE_URL,
  NEXT_PUBLIC_REPORTS_URL: production ? 'https://staypack.app' : config.vars.SITE_URL,
  STAYPACK_BRANCH_PREVIEW: production ? '0' : '1', STAYPACK_REGRESSION_PREVIEW: production ? '0' : '1' });
async function run(command, args) {
  const code = await new Promise((accept, reject) => { const child = spawn(command, args, { env, stdio: 'inherit' }); child.on('error', reject); child.on('close', accept); });
  if (code !== 0) throw new Error(`${command} failed (${code})`);
}
try { await run('npm', ['run', 'build:vinext']); }
finally { await rm('dist/server/.dev.vars', { force: true }); }
await cp('dist', resolve(output, 'dist'), { recursive: true });
if (production) {
  await run('npm', ['run', 'build:report-worker']);
  await cp('.report-worker', resolve(output, 'report'), { recursive: true });
}
// Reject hidden dotenv files/symlinks and accidental credential values before upload.
for (const entry of await readdir(output, { recursive: true, withFileTypes: true })) {
  if (entry.isSymbolicLink() || /^(?:\.env|\.dev\.vars)/.test(entry.name)) throw new Error('Unexpected private file in build');
  if (!entry.isFile()) continue;
  const body = await readFile(resolve(entry.parentPath, entry.name));
  for (const [key, value] of Object.entries(process.env)) {
    if (/SECRET|PASSWORD|SERVICE_ROLE|API_TOKEN|ACCESS_KEY/.test(key) && value.length > 15 && body.includes(Buffer.from(value))) throw new Error(`Credential embedded in build: ${key}`);
  }
  if (!production && body.includes(Buffer.from('qmtfugaeujeikyegoxwi.supabase.co'))) throw new Error('Production database URL found in preview artifact');
}
await writeFile(resolve(output, 'release.json'), JSON.stringify({ sha, branch, mode: production ? 'production' : 'preview', schema: 1 }));
console.log(`Prepared ${production ? 'production' : 'synthetic preview'} artifact for ${sha}`);
