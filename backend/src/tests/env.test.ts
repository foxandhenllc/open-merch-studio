import test from 'node:test';
import assert from 'node:assert/strict';
import { backendUrlFromEnv } from '../config/env.js';

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
});
