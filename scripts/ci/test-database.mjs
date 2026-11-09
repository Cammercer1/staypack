import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Fixtures intentionally emulate the relevant Supabase roles in an EMPTY local
// PostgreSQL instance. No hosted project credentials are accepted here.
const docker = process.env.CI_POSTGRES_CONTAINER;
const url = new URL(process.env.CI_DATABASE_URL || 'postgresql://postgres:ci-only@127.0.0.1:5432/staypack_ci');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/staypack_ci') throw new Error('Database tests require a disposable loopback staypack_ci database');
if (docker && !/^staypack-ci-pg-[a-z0-9-]+$/.test(docker)) throw new Error('Unexpected disposable container name');
function sql(source, capture = false) {
  const args = docker ? ['exec', '-i', docker, 'psql', '-U', 'postgres', '-d', 'staypack_ci', '-v', 'ON_ERROR_STOP=1', '-At'] : [url.toString(), '-v', 'ON_ERROR_STOP=1', '-At'];
  const result = spawnSync(docker ? 'docker' : 'psql', args, { input: source, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(result.stderr || 'Database assertion failed');
  if (capture) return result.stdout.trim();
}
if (sql("select count(*) from information_schema.tables where table_schema='public';", true) !== '0') throw new Error('Refusing to run fixtures in a nonempty database');
const files = [
  'tests/str_workspace_fixture.sql',
  'migrations/20261010232632_str_appraisal_workspace.sql',
  'migrations/20261010233726_str_recipient_conflict_http_status.sql',
  'tests/str_workspace_assertions.sql',
  'tests/digital_proposal_fixture.sql',
  'migrations/20261012000950_digital_proposal_workspace.sql',
  'migrations/20261012002612_digital_proposal_draft_index.sql',
  'tests/digital_proposal_assertions.sql',
  'migrations/20261012020830_digital_proposal_integration.sql',
  'migrations/20261012021839_proposal_activity_version_details.sql',
  'migrations/20261013045131_detached_prospect_brands.sql',
  'migrations/20261014062925_shared_appraisal_workspace.sql',
  'tests/stable_proposal_links_fixture.sql',
  'migrations/20261021065728_stable_proposal_share_links.sql',
  'tests/stable_proposal_links_assertions.sql',
  'tests/proposal_link_history_api_fixture.sql',
  'migrations/20261021084230_proposal_link_history_api_compatibility.sql',
  'tests/proposal_link_history_api_assertions.sql',
];
for (const file of files) { sql(await readFile(`supabase/${file}`, 'utf8')); console.log(`Passed ${file}`); }
