import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import {
  readMerchantProfile,
  saveMerchantProfile,
  publishMerchantProfile,
} from '../admin/merchant-profile.service.js';
import { createDeploymentSettings } from '../admin/deployment-settings.js';

test('private profile drafts survive readback, reject stale reviews and publish only the reviewed revision', async () => {
  const original = { database: env.databaseUrl, mode: env.nodeEnv };
  env.databaseUrl = undefined;
  env.nodeEnv = 'test';
  const writes: Array<Record<string, unknown>> = [];
  const bridge = createDeploymentSettings(
    { token: 'fixture', projectId: 'prj_fixture', teamId: 'team_fixture' },
    async (url, init) => {
      if (String(url).includes('/v9/'))
        return Response.json({ id: 'prj_fixture', accountId: 'team_fixture' });
      const variables = JSON.parse(String(init?.body)) as Array<Record<string, unknown>>;
      writes.push(...variables);
      return Response.json({ created: variables, failed: [] });
    }
  );
  try {
    const before = await readMerchantProfile();
    const draft = structuredClone(before.draft);
    draft.fields['brand.displayName'] = 'Fixture Store';
    draft.fields['operator.supportEmail'] = 'support@example.org';
    draft.policyVersion = 'fixture-approved-2';
    const saved = await saveMerchantProfile(draft, before.revision, before.activeDigest);
    assert.equal(saved.requiresPolicyReview, true);
    assert.deepEqual((await readMerchantProfile()).draft, draft);
    assert.notEqual(saved.active.fields['brand.displayName'], 'Fixture Store');
    await assert.rejects(
      () => saveMerchantProfile(draft, before.revision, before.activeDigest),
      /another session/
    );
    await assert.rejects(
      () => publishMerchantProfile(saved.revision, 'wrong-digest', true, bridge),
      /exact draft/
    );
    await assert.rejects(
      () => publishMerchantProfile(saved.revision, saved.digest, false, bridge),
      /approve this exact/
    );
    assert.equal(writes.length, 0);
    const result = await publishMerchantProfile(saved.revision, saved.digest, true, bridge);
    assert.equal(result.pending, true);
    const value = writes.find((item) => item.key === 'OMS_MERCHANT_PROFILE')!;
    assert.equal(value.type, 'encrypted');
    assert.deepEqual(value.target, ['production']);
    const publication = JSON.parse(String(value.value));
    assert.equal(publication.config.operator.supportEmail, 'support@example.org');
    assert.equal(publication.policy.merchant.displayName, 'Fixture Store');
    assert.deepEqual(publication.policy.pages, before.draft.pages);
    assert.equal((await readMerchantProfile()).activeDigest, before.activeDigest);
    const later = await saveMerchantProfile(
      { ...draft, policyVersion: 'fixture-approved-3' },
      saved.revision,
      saved.activeDigest
    );
    await assert.rejects(
      () => publishMerchantProfile(saved.revision, saved.digest, true, bridge),
      /another session/
    );
    assert.ok(later.revision > saved.revision);
    env.nodeEnv = 'production';
    await assert.rejects(readMerchantProfile, /could not be confirmed/);
  } finally {
    env.databaseUrl = original.database;
    env.nodeEnv = original.mode;
  }
});

test('profile endpoints require installation admin access and never accept arbitrary top-level inputs', async () => {
  const code = env.adminAccessCode;
  env.adminAccessCode = 'fixture-profile-admin';
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/admin/profile`;
  try {
    for (const method of ['GET', 'PUT', 'POST']) {
      const response = await fetch(url + (method === 'POST' ? '/publish' : ''), { method });
      assert.equal(response.status, 401);
      assert.match(response.headers.get('cache-control')!, /no-store/);
    }
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-access': env.adminAccessCode },
      body: JSON.stringify({ token: 'unaccepted-secret' }),
    });
    assert.equal(response.status, 400);
    assert.ok(!(await response.text()).includes('unaccepted-secret'));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    env.adminAccessCode = code;
  }
});
