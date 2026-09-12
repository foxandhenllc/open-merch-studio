import assert from 'node:assert/strict';
import test from 'node:test';
import { expiredPreparation, preparationGraceMs } from '../collections/retention-policy.js';

test('retention refuses fresh, foreign, duplicate and path-tampered manifests', () => {
  const now = Date.now();
  const quoteId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';
  const m = {
    schemaVersion: 1,
    quoteId,
    sessionId: 'fixture',
    namespace: 'private-fixture',
    quote: { id: quoteId, expiresAt: new Date(now - preparationGraceMs - 1).toISOString() },
    files: [
      {
        assetId,
        path: `owner-artwork/${assetId}/purchase.png`,
        byteSize: 100,
        sha256: 'a'.repeat(64),
      },
    ],
  };
  assert.ok(expiredPreparation(m, 'private-fixture', now));
  for (const invalid of [
    null,
    {},
    { ...m, schemaVersion: 2 },
    { ...m, namespace: 'other-bucket' },
    { ...m, quote: { ...m.quote, expiresAt: new Date(now).toISOString() } },
    { ...m, files: [...m.files, ...m.files] },
    { ...m, files: [{ ...m.files[0], path: 'owner-artwork/../original.png' }] },
    { ...m, quote: { ...m.quote, id: 'foreign-quote' } },
    { ...m, files: [{ ...m.files[0], byteSize: -1 }] },
  ])
    assert.equal(expiredPreparation(invalid, 'private-fixture', now), null);
});
