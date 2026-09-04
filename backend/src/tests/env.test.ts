import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backendUrlFromEnv,
  emailProviderFromEnv,
  frontendUrlFromEnv,
  transactionalEmailSettingsFromEnv,
} from '../config/env.js';

test('production asset URLs use the canonical Vercel host when BACKEND_URL is omitted', () => {
  assert.equal(
    backendUrlFromEnv({ VERCEL_PROJECT_PRODUCTION_URL: 'open-merch-studio.example.vercel.app' }),
    'https://open-merch-studio.example.vercel.app'
  );
  assert.equal(
    backendUrlFromEnv({
      BACKEND_URL: 'https://merch.example.com',
      VERCEL_URL: 'preview.vercel.app',
    }),
    'https://merch.example.com'
  );
  assert.equal(
    backendUrlFromEnv({ BACKEND_URL: ' https://openmerchstudio.com/// ' }),
    'https://openmerchstudio.com'
  );
});

test('browser origins remove trailing slashes before CORS and Stripe return URLs', () => {
  assert.equal(
    frontendUrlFromEnv({ FRONTEND_URL: ' https://openmerchstudio.com/ ' }),
    'https://openmerchstudio.com'
  );
  assert.equal(frontendUrlFromEnv({}), 'http://localhost:5173');
});

test('transactional email configuration is disabled and fixture-only by default', () => {
  assert.deepEqual(transactionalEmailSettingsFromEnv({}), {
    enabled: false,
    provider: 'fixture',
    from: undefined,
    replyTo: undefined,
    supportEmail: 'support@openmerchstudio.com',
    resendApiKey: undefined,
    resendWebhookSecret: undefined,
  });
  assert.equal(emailProviderFromEnv(undefined), 'fixture');
  assert.equal(emailProviderFromEnv('unknown'), 'fixture');
});

test('transactional email configuration parses future provider values without sending', () => {
  assert.deepEqual(
    transactionalEmailSettingsFromEnv({
      TRANSACTIONAL_EMAILS_ENABLED: 'true',
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: ' Open Merch Studio <orders@example.com> ',
      EMAIL_REPLY_TO: ' support@example.com ',
      SUPPORT_EMAIL: ' help@example.com ',
      RESEND_API_KEY: ' re_fixture_key ',
      RESEND_WEBHOOK_SECRET: ' whsec_fixture_value ',
    }),
    {
      enabled: true,
      provider: 'resend',
      from: 'Open Merch Studio <orders@example.com>',
      replyTo: 'support@example.com',
      supportEmail: 'support@openmerchstudio.com',
      resendApiKey: 're_fixture_key',
      resendWebhookSecret: 'whsec_fixture_value',
    }
  );
});
