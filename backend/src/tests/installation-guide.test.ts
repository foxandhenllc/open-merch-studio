import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';
import { env } from '../config/env.js';
import { createApp } from '../app.js';
import { requiredMigrations } from '../admin/migration-contract.js';
import { assessMigrations, installationChecks } from '../admin/installation-checks.js';
import {
  readInstallationProgress,
  saveInstallationProgress,
} from '../admin/installation-progress.js';

test('installation migration checks cannot omit a committed migration or accept interrupted history', () => {
  const names = readdirSync(new URL('../../prisma/migrations/', import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual([...requiredMigrations], names);
  const complete = names.map((migration_name) => ({
    migration_name,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  assert.equal(assessMigrations(complete).status, 'verified');
  assert.equal(assessMigrations(complete.slice(1)).status, 'action');
  assert.equal(
    assessMigrations([
      ...complete,
      { migration_name: 'interrupted', finished_at: null, rolled_back_at: null },
    ]).status,
    'action'
  );
});

test('setup progress resumes with explicit confirmations, rejects stale writes and clears after account changes', async () => {
  const before = {
    database: env.databaseUrl,
    mode: env.nodeEnv,
    key: env.stripeSecretKey,
    storage: env.supabaseServiceRoleKey,
    admin: env.adminAccessCode,
  };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  env.supabaseServiceRoleKey = undefined;
  env.adminAccessCode = 'fixture-guide-admin';
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    for (const [path, method] of [
      ['installation-progress', 'GET'],
      ['installation-progress', 'PUT'],
      ['installation-checks', 'GET'],
    ])
      assert.equal(
        (await fetch(`http://127.0.0.1:${address.port}/api/admin/${path}`, { method })).status,
        401
      );
    const initial = await readInstallationProgress();
    const input = {
      revision: initial.revision,
      basis: initial.basis,
      persona: 'artist',
      completed: ['identity', 'collection'],
    };
    await saveInstallationProgress(input);
    const saved = await readInstallationProgress();
    assert.equal(saved.persona, 'artist');
    assert.deepEqual(saved.completed, ['identity', 'collection']);
    await assert.rejects(() => saveInstallationProgress(input), /another session/);
    await assert.rejects(
      () => saveInstallationProgress({ ...input, token: 'should-never-save' }),
      /supported store type/
    );
    await assert.rejects(
      () => saveInstallationProgress({ ...input, completed: ['identity', 'identity'] }),
      /supported store type/
    );
    env.stripeSecretKey = 'fixture-rotated-account';
    const changed = await readInstallationProgress();
    assert.deepEqual(changed.completed, []);
    assert.equal(changed.contextChanged, true);
    assert.ok(!JSON.stringify(changed).includes(env.stripeSecretKey));
    await assert.rejects(
      () => saveInstallationProgress({ ...input, revision: saved.revision }),
      /deployed store changed/
    );
    const next = await saveInstallationProgress({
      revision: changed.revision,
      basis: changed.basis,
      persona: 'coffee',
      completed: ['identity'],
    });
    assert.equal(next.contextChanged, false);
    assert.deepEqual(next.completed, ['identity']);
    const checks = await installationChecks();
    assert.equal(checks.checks.find((check) => check.id === 'database')?.status, 'simulated');
    assert.equal(checks.checks.find((check) => check.id === 'storage')?.status, 'simulated');
    assert.ok(!JSON.stringify(checks).includes(env.stripeSecretKey));
    assert.equal(checks.checkoutAccessMode, env.checkoutAccessMode);
    env.nodeEnv = 'production';
    await assert.rejects(readInstallationProgress, /could not be loaded/);
  } finally {
    env.databaseUrl = before.database;
    env.nodeEnv = before.mode;
    env.stripeSecretKey = before.key;
    env.supabaseServiceRoleKey = before.storage;
    env.adminAccessCode = before.admin;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
