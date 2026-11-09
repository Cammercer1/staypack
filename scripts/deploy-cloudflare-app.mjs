import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// Run the checked production build first. Local values are sent as encrypted
// Worker secrets, never placed in the source tree or a command-line argument.
try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const config = JSON.parse(await readFile('dist/server/wrangler.json', 'utf8'));
if (config.name !== 'staypack-app' || config.account_id !== 'fc594f30144c9ba2a1cb9a5c3ce1313a') throw new Error('Build the production app before deploying');
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== 'qmtfugaeujeikyegoxwi.supabase.co') throw new Error('Unexpected database target');
const names = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'STORAGE_PROVIDER', 'R2_ACCESS_KEY_ID', 'R2_ACCOUNT_ID', 'R2_PRIVATE_BUCKET', 'R2_PUBLIC_BASE_URL', 'R2_PUBLIC_BUCKET', 'R2_SECRET_ACCESS_KEY',
  'BROWSERLESS_API_KEY', 'BROWSERLESS_BASE_URL', 'BROWSERLESS_TIMEOUT_MS', 'AIRBTICS_API_KEY', 'AIRBTICS_BASE_URL', 'AIRROI_API_KEY', 'OPENAI_API_KEY',
  'PROP_RADAR_API_KEY', 'RAPIDAPI_REA_KEY', 'RAPIDAPI_REA_HOST', 'BRIGHTDATA_API_KEY', 'BRIGHTDATA_REA_DATASET_ID', 'BRIGHTDATA_UNLOCKER_ZONE', 'BRIGHTDATA_SCRAPE_TIMEOUT_MS', 'REA_PRIMARY_PROVIDER',
  'GOOGLE_MAPS_API_KEY', 'APIFY_API_KEY', 'APIFY_REA_MAX_LISTINGS', 'RESEND_API_KEY', 'DELIVERY_FROM_EMAIL', 'DELIVERY_CRON_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'BILLING_MODE', 'BILLING_SITE_URL', 'STRIPE_ACCOUNT_ID', 'STRIPE_PORTAL_CONFIGURATION_ID', 'STRIPE_WEBHOOK_SECRET', 'BILLING_CRON_SECRET', 'BILLING_PLANS_JSON', 'STRIPE_AUTOMATIC_TAX',
  'CANDIDATE_ACCESS_KEY',
];
for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'BROWSERLESS_API_KEY', 'BILLING_MODE']) if (!process.env[name]) throw new Error(`Missing deployment setting: ${name}`);
const directory = await mkdtemp(join(tmpdir(), 'staypack-deploy-'));
try {
  const path = join(directory, 'secrets.json');
  await writeFile(path, JSON.stringify(Object.fromEntries(names.filter(name => process.env[name]).map(name => [name, process.env[name]]))), { mode: 0o600 });
  const code = await new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', 'wrangler@4.158.0', 'deploy', '--config', 'dist/server/wrangler.json', '--secrets-file', path], { stdio: 'inherit' });
    child.on('error', reject); child.on('close', resolve);
  });
  if (code !== 0) throw new Error(`Deployment failed (${code})`);
} finally { await rm(directory, { recursive: true, force: true }); }
