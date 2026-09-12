import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import { reserveCollectionPreparation } from '../collections/purchase-limits.js';

test('collection preparation limits serialize concurrent requests and recover after the window', async () => {
  const previous = { ...env };
  Object.assign(env, { databaseUrl: undefined, nodeEnv: 'test' });
  try {
    const now = Date.now();
    const attempts = await Promise.allSettled(
      Array.from({ length: 35 }, () => reserveCollectionPreparation('fixture-session', now))
    );
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 30);
    assert.ok(
      attempts
        .filter((attempt) => attempt.status === 'rejected')
        .every((attempt) => attempt.reason.errorCode === 'collection_preparation_limit')
    );
    for (let index = 0; index < 90; index++)
      await reserveCollectionPreparation(`session-${index}`, now);
    await assert.rejects(() => reserveCollectionPreparation('rotating-session', now), {
      statusCode: 429,
    });
    await reserveCollectionPreparation('fixture-session', now + 3600001);
  } finally {
    Object.assign(env, previous);
  }
});
