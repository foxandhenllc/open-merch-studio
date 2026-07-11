import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../config/env.js';
import { prepareArtworkForPrint } from '../services/background-removal.service.js';

test('GPT Image 2 artwork clearly reports when external background removal is not configured', async () => {
  const original = env.removeBgApiKey;
  env.removeBgApiKey = undefined;
  try {
    const result = await prepareArtworkForPrint({
      imageUrl: 'data:image/png;base64,YWJj',
      model: 'gpt-image-2',
    });
    assert.equal(result.status, 'required');
    assert.equal(result.provider, 'none');
    assert.match(result.message, /REMOVE_BG_API_KEY/);
  } finally {
    env.removeBgApiKey = original;
  }
});
