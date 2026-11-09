import { repository, validateSha } from './config.mjs';

export function validateSourceRun(run, sha, branch) {
  validateSha(sha);
  if (run.path !== '.github/workflows/ci.yml' || run.event !== 'push' || run.head_repository?.full_name !== repository || run.head_sha !== sha || run.head_branch !== branch || run.conclusion !== 'success') throw new Error('Untrusted or unsuccessful source workflow');
}
export function validateManifest(manifest, sha, branch) {
  validateSha(sha);
  if (manifest.sha !== sha || manifest.branch !== branch || manifest.mode !== (branch === 'main' ? 'production' : 'preview') || manifest.schema !== 1) throw new Error('Artifact identity mismatch');
}
