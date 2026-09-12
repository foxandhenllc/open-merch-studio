import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import {
  readStoreSettings,
  saveStoreSettings,
  withStoreSettings,
  activeImageModel,
} from '../admin/store-settings.js';
import { connectionSummaries, validateConnectionUpdate } from '../admin/provider-connections.js';
import { createDeploymentSettings } from '../admin/deployment-settings.js';
import { getRuntimeSettings } from '../services/runtime-store.js';
import { setOperationalSink } from '../utils/operational-logger.js';

const bridge = {
  token: 'fixture-hosting-secret',
  projectId: 'prj_fixture',
  teamId: 'team_fixture',
  deployHook: 'https://api.vercel.com/v1/integrations/deploy/prj_fixture/fixtureHook',
};

test('admin model selection persists across app instances, rejects stale/unknown writes and isolates in-flight requests', async () => {
  const previous = { database: env.databaseUrl, nodeEnv: env.nodeEnv, admin: env.adminAccessCode };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  env.adminAccessCode = 'fixture-admin-code';
  setOperationalSink(() => undefined);
  const server = createApp().listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { 'Content-Type': 'application/json', 'x-admin-access': 'fixture-admin-code' };
  try {
    for (const path of ['/setup', '/store-settings', '/connections/openai', '/deployment']) {
      const response = await fetch(`${base}/api/admin${path}`, {
        method:
          path === '/setup'
            ? 'GET'
            : path === '/connections/openai'
              ? 'PUT'
              : path === '/store-settings'
                ? 'PATCH'
                : 'POST',
      });
      assert.equal(response.status, 401);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    }
    const first = await readStoreSettings();
    const change = await fetch(`${base}/api/admin/store-settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        revision: first.revision,
        values: {
          imageModel: 'gpt-image-2.5-sunburst',
          dailyAiBudgetCents: 2000,
          perSessionBudgetCents: 300,
          freeDraftLimit: 4,
        },
      }),
    });
    assert.equal(change.status, 200);
    const saved = await readStoreSettings();
    assert.equal(saved.values.imageModel, 'gpt-image-2.5-sunburst');
    assert.equal(saved.revision, first.revision + 1);
    const snapshotResponse = await fetch(`${base}/api/admin/setup`, { headers }).then((response) =>
      response.json()
    );
    const snapshot = snapshotResponse as {
      data: { settings: { values: { imageModel: string }; storage: string } };
    };
    assert.equal(snapshot.data.settings.values.imageModel, saved.values.imageModel);
    assert.equal(snapshot.data.settings.storage, 'fixture');
    const old = await fetch(`${base}/api/admin/store-settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        revision: first.revision,
        values: { imageModel: 'gpt-image-2.5-sunburst' },
      }),
    });
    assert.equal(old.status, 409);
    for (const values of [
      { imageModel: 'invented-model' },
      { imageModel: 'gpt-image-2' },
      { dailyAiBudgetCents: -1 },
      { perSessionBudgetCents: 9000 },
      { checkoutEnabled: true },
      { freeDraftLimit: '5' },
      { OPENAI_API_KEY: 'secret' },
    ]) {
      const rejected = await fetch(`${base}/api/admin/store-settings`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ revision: saved.revision, values }),
      });
      assert.equal(rejected.status, 400);
    }
    assert.equal((await readStoreSettings()).revision, saved.revision);
    await Promise.all(
      ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare'].map((imageModel) =>
        withStoreSettings({ ...saved.values, imageModel }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          assert.equal(activeImageModel(), imageModel);
          assert.equal(getRuntimeSettings().dailyAiBudgetCents, 2000);
        })
      )
    );
    const session = await fetch(`${base}/api/design/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(session.status, 201);
    const sessionData = (await session.json()) as { data: { freeDraftLimit: number } };
    assert.equal(sessionData.data.freeDraftLimit, 4);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await fetch(`${base}/api/admin/setup`, { headers: { 'x-admin-access': 'incorrect' } });
    }
    assert.equal(
      (await fetch(`${base}/api/admin/setup`, { headers: { 'x-admin-access': 'incorrect' } }))
        .status,
      429
    );
    assert.equal((await fetch(`${base}/api/admin/setup`, { headers })).status, 200);
    env.nodeEnv = 'production';
    await assert.rejects(readStoreSettings, /database connection/);
    await assert.rejects(
      () => saveStoreSettings({ imageModel: 'gpt-image-2.5-sunburst' }, saved.revision),
      /database connection/
    );
  } finally {
    server.close();
    await once(server, 'close');
    env.databaseUrl = previous.database;
    env.nodeEnv = previous.nodeEnv;
    env.adminAccessCode = previous.admin;
    setOperationalSink();
  }
});

test('connection summaries and validation never expose secret values or accept arbitrary env names', () => {
  const original = env.openaiApiKey;
  env.openaiApiKey = 'fixture-private-key-never-return';
  try {
    const summaries = connectionSummaries();
    assert.ok(!JSON.stringify(summaries).includes(env.openaiApiKey));
    assert.equal(summaries[0].fields[0].configured, true);
    assert.throws(() => validateConnectionUpdate('openai', { NODE_OPTIONS: '--import evil' }));
    assert.throws(() => validateConnectionUpdate('openai', { CHECKOUT_ACCESS_MODE: 'public' }));
    assert.throws(() => validateConnectionUpdate('openai', { OPENAI_API_KEY: 'a\nb' }));
    assert.throws(() => validateConnectionUpdate('openai', { ENABLE_LIVE_OPENAI: 'anything' }));
    assert.throws(() =>
      validateConnectionUpdate('storage', { DATABASE_URL: 'https://not-postgres' })
    );
    assert.throws(() =>
      validateConnectionUpdate('storage', { SUPABASE_URL: 'file:///tmp/secret' })
    );
  } finally {
    env.openaiApiKey = original;
  }
});

test('hosting bridge verifies identity, scopes production, saves secrets as sensitive, and never returns provider payloads', async () => {
  const requests: Array<{ url: string; body?: unknown; method?: string }> = [];
  const request: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, body, method: init?.method });
    assert.equal(new URL(url).searchParams.get('teamId'), bridge.teamId);
    if (url.includes('/v9/'))
      return Response.json({ id: bridge.projectId, accountId: bridge.teamId });
    if (init?.method === 'POST')
      return Response.json({
        created: body.map((item: { key: string; value: string }) => ({
          ...item,
          secretProviderPayload: 'never-return',
        })),
        failed: [],
      });
    return Response.json({
      envs: [
        { key: 'OMS_CONNECTIONS_REVISION', value: 'new-revision', target: ['production'] },
        { key: 'OPENAI_API_KEY', value: 'never-return', target: ['production'] },
      ],
    });
  };
  const provider = createDeploymentSettings(bridge, request);
  const saved = await provider.save('openai', {
    OPENAI_API_KEY: 'fixture-openai-key',
    ENABLE_LIVE_OPENAI: 'true',
  });
  assert.deepEqual(saved, { savedKeys: ['OPENAI_API_KEY', 'ENABLE_LIVE_OPENAI'], pending: true });
  const write = requests[1];
  assert.match(write.url, /upsert=true/);
  const body = write.body as Array<{ key: string; type: string; target: string[] }>;
  assert.equal(body[0].type, 'sensitive');
  assert.ok(body.every((item) => JSON.stringify(item.target) === '["production"]'));
  assert.equal((await provider.status()).pending, true);
  assert.ok(!JSON.stringify(await provider.status()).includes('never-return'));
  const denied = createDeploymentSettings(bridge, async () =>
    Response.json({ id: 'prj_other', accountId: bridge.teamId })
  );
  await assert.rejects(
    () => denied.save('openai', { OPENAI_API_KEY: 'fixture-key' }),
    /does not match/
  );
  const failed = createDeploymentSettings(
    bridge,
    async () => new Response('secret-account-payload', { status: 403 })
  );
  await assert.rejects(
    () => failed.save('openai', { OPENAI_API_KEY: 'fixture-key' }),
    (error: Error) => !error.message.includes('secret-account-payload')
  );
  const partial = createDeploymentSettings(bridge, async (url) =>
    String(url).includes('/v9/')
      ? Response.json({ id: bridge.projectId, accountId: bridge.teamId })
      : Response.json({ created: [], failed: [{ value: 'private' }] })
  );
  await assert.rejects(
    () => partial.save('openai', { OPENAI_API_KEY: 'fixture-key' }),
    /Some values could not be saved/
  );
  const missingActivationMarker = createDeploymentSettings(bridge, async (url) =>
    String(url).includes('/v9/')
      ? Response.json({ id: bridge.projectId, accountId: bridge.teamId })
      : Response.json({ created: [{ key: 'OPENAI_API_KEY' }], failed: [] })
  );
  await assert.rejects(
    () => missingActivationMarker.save('openai', { OPENAI_API_KEY: 'fixture-key' }),
    /save could not be verified/
  );
  const unreadableStatus = createDeploymentSettings(bridge, async (url) =>
    String(url).includes('/v9/')
      ? Response.json({ id: bridge.projectId, accountId: bridge.teamId })
      : Response.json({ unexpected: 'private-provider-payload' })
  );
  assert.equal((await unreadableStatus.status()).status, 'connection_failed');
  await assert.rejects(
    () =>
      createDeploymentSettings(undefined, request).save('openai', {
        OPENAI_API_KEY: 'fixture-key',
      }),
    /installation settings/
  );
});

test('redeploy only accepts the configured project hook and reports a request rather than completion', async () => {
  const request: typeof fetch = async (url, init) => {
    if (String(url).includes('/v9/'))
      return Response.json({ id: bridge.projectId, accountId: bridge.teamId });
    assert.equal(String(url), bridge.deployHook);
    assert.equal(init?.method, 'POST');
    assert.equal(init?.headers, undefined);
    return Response.json({ job: { id: 'job_fixture', state: 'PENDING' } });
  };
  assert.deepEqual(await createDeploymentSettings(bridge, request).redeploy(), {
    status: 'requested',
  });
  for (const deployHook of [
    'https://example.com/hook',
    'https://api.vercel.com/v1/integrations/deploy/prj_other/key',
    'https://api.vercel.com/v1/integrations/deploy/prj_fixture/key?token=bad',
  ]) {
    await assert.rejects(
      () => createDeploymentSettings({ ...bridge, deployHook }, request).redeploy(),
      /deploy hook/
    );
  }
});
