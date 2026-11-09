import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceRun, validateManifest } from './validation.mjs';
const sha = 'a'.repeat(40), branch = 'codex/change';
const run = { path: '.github/workflows/ci.yml', event: 'push', head_repository: { full_name: 'Cammercer1/staypack' }, head_sha: sha, head_branch: branch, conclusion: 'success' };
const manifest = { sha, branch, mode: 'preview', schema: 1 };
test('only a successful matching repository push can supply a deploy artifact', () => {
  validateSourceRun(run, sha, branch);
  for (const change of [
    { path: '.github/workflows/other.yml' }, { event: 'pull_request' },
    { head_repository: { full_name: 'someone/fork' } }, { head_repository: null },
    { head_sha: 'b'.repeat(40) }, { head_branch: 'main' },
    { conclusion: 'failure' }, { conclusion: 'cancelled' }, { conclusion: null },
  ]) assert.throws(() => validateSourceRun({ ...run, ...change }, sha, branch));
});
test('branch output cannot claim a production identity or another commit', () => {
  validateManifest(manifest, sha, branch);
  for (const change of [{ sha: 'b'.repeat(40) }, { branch: 'main' }, { mode: 'production' }, { schema: 2 }]) assert.throws(() => validateManifest({ ...manifest, ...change }, sha, branch));
  assert.throws(() => validateManifest(manifest, sha, 'main'));
});
