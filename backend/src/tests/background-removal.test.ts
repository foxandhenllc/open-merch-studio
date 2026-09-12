import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareArtworkForPrint } from '../services/background-removal.service.js';

test('legacy artwork never calls a retired external background-removal provider', async () => {
  const original = process.env.REMOVE_BG_API_KEY;
  process.env.REMOVE_BG_API_KEY = undefined;
  try {
    const result = await prepareArtworkForPrint({
      imageUrl: 'data:image/png;base64,YWJj',
      model: 'gpt-image-2',
    });
    assert.equal(result.status, 'required');
    assert.equal(result.provider, 'none');
    assert.match(result.message, /transparent print file/);
  } finally {
    process.env.REMOVE_BG_API_KEY = original;
  }
});

test('retired upload removal fails before changing the artwork', async () => {
  const { completeArtworkUpload } = await import('../services/uploaded-artwork.service.js');
  await assert.rejects(
    () =>
      completeArtworkUpload({ assetId: 'unused', rightsConfirmed: true, removeBackground: true }),
    { errorCode: 'background_removal_retired' }
  );
});
