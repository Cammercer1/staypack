import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewConfig, previewName, productionConfig, validateSha } from './config.mjs';
test('branch names never become shell, path or production worker names', () => {
  for (const branch of ['codex/change', '../main', 'test; echo bad', '$(bad)', 'feature"branch']) assert.match(previewName(branch), /^staypack-prv-[a-f0-9]{16}$/);
  assert.throws(() => previewName('main'));
  assert.throws(() => validateSha('../artifact'));
});
test('production preserves print routing, queues, cron and existing runtime secrets', async () => {
  const config = await productionConfig('a'.repeat(40), process.cwd(), '/tmp/artifact');
  assert.equal(config.name, 'staypack-app');
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.keep_vars, true);
  assert.ok(config.routes.some(route => route.pattern === 'staypack.app/proposal/print/*'));
  assert.equal(config.queues.consumers[0].queue, 'staypack-appraisals');
  assert.deepEqual(config.triggers.crons, ['* * * * *']);
  assert.equal(config.vars.STAYPACK_BRANCH_PREVIEW, undefined);
  assert.equal(config.main, '/tmp/artifact/dist/server/index.js');
});
test('preview config has no production services, secrets, routes, schedules or queues', () => {
  const config = previewConfig('codex/change', 'a'.repeat(40), '/workspace', true);
  assert.deepEqual(config.routes, []);
  for (const field of ['services', 'queues', 'triggers', 'r2_buckets', 'd1_databases']) assert.equal(config[field], undefined);
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.vars.NEXT_PUBLIC_SUPABASE_URL, 'https://preview.invalid');
  assert.equal(config.vars.BILLING_MODE, 'disabled');
});
