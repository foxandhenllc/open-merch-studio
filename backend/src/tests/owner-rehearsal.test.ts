import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownerRehearsalEnabled } from '../config/owner-rehearsal.js';
import { isPrivateUploadPrint } from '../services/private-upload-print.js';

test('durable simulation is restricted to an explicit, credential-free loopback harness', () => {
  const valid = {
    OMS_OWNER_REHEARSAL: 'local-only',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://local@127.0.0.1:5432/oms_owner_lab_initial',
    BACKEND_URL: 'http://127.0.0.1:5188',
    FRONTEND_URL: 'http://127.0.0.1:5188',
    SUPABASE_URL: 'http://127.0.0.1:5188',
    SUPABASE_SERVICE_ROLE_KEY: 'owner-lab-storage-only',
    ENABLE_LIVE_OPENAI: 'false',
    ENABLE_LIVE_STRIPE: 'false',
    ENABLE_LIVE_PRINTFUL: 'false',
    ALLOW_LIVE_PAYMENTS: 'false',
    ALLOW_LIVE_FULFILLMENT: 'false',
    PRINTFUL_AUTO_CONFIRM_ORDERS: 'false',
    TRANSACTIONAL_EMAILS_ENABLED: 'false',
  };
  assert.equal(ownerRehearsalEnabled(valid), true);
  for (const invalid of [
    { NODE_ENV: 'production' },
    { VERCEL: '1' },
    { OMS_OWNER_REHEARSAL: '' },
    { DATABASE_URL: 'postgresql://local@remote.example/oms_owner_lab_initial' },
    { DATABASE_URL: 'postgresql://local@127.0.0.1/production' },
    { BACKEND_URL: 'https://store.example' },
    { FRONTEND_URL: 'http://evil.example' },
    { SUPABASE_URL: 'https://real.supabase.co' },
    { OPENAI_API_KEY: 'real-key' },
    { ENABLE_LIVE_STRIPE: 'true' },
    { ALLOW_LIVE_FULFILLMENT: 'true' },
  ])
    assert.equal(ownerRehearsalEnabled({ ...valid, ...invalid }), false);
});
test('private uploaded prints cannot be confused with legacy public or collection paths', () => {
  const id = 'c109897b-785f-4411-843b-5693dd41b7de';
  assert.equal(
    isPrivateUploadPrint({ sourceType: 'uploaded', printStoragePath: `${id}/${id}/print.png` }),
    true
  );
  assert.equal(
    isPrivateUploadPrint({
      sourceType: 'uploaded',
      printStoragePath: `private-uploads/${id}/print.png`,
    }),
    true
  );
  assert.equal(
    isPrivateUploadPrint({
      sourceType: 'uploaded',
      printStoragePath: `sess_example_abc/${id}/print.png`,
    }),
    true
  );
  for (const path of [
    `uploads/${id}/print.png`,
    `owner-artwork/${id}/print.png`,
    `${id}/../print.png`,
    null,
  ])
    assert.equal(isPrivateUploadPrint({ sourceType: 'uploaded', printStoragePath: path }), false);
  assert.equal(
    isPrivateUploadPrint({ sourceType: 'collection', printStoragePath: `${id}/${id}/print.png` }),
    false
  );
});
