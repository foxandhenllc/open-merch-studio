import test from 'node:test';
import assert from 'node:assert/strict';
import { dataUrlToBuffer } from '../services/openai-design-provider.js';
import { uploadArtworkAsset } from '../services/artwork-storage.service.js';

test('dataUrlToBuffer decodes generated PNG artwork payloads', () => {
  const decoded = dataUrlToBuffer('data:image/png;base64,aGVsbG8=');

  assert.equal(decoded?.contentType, 'image/png');
  assert.equal(decoded?.buffer.toString('utf8'), 'hello');
});

test('uploadArtworkAsset stores artwork under deterministic design asset path', async () => {
  const uploadCalls: Array<{
    bucket: string;
    path: string;
    contentType: string;
    upsert: boolean;
  }> = [];
  const client = {
    storage: {
      from(bucket: string) {
        return {
          upload: async (
            path: string,
            _body: Buffer,
            options: { contentType?: string; upsert?: boolean }
          ) => {
            uploadCalls.push({
              bucket,
              path,
              contentType: options.contentType ?? '',
              upsert: Boolean(options.upsert),
            });
            return { data: { path }, error: null };
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://cdn.example.test/storage/${bucket}/${path}` },
          }),
        };
      },
    },
  };

  const result = await uploadArtworkAsset({
    assetId: 'asset_123',
    imageUrl: 'data:image/png;base64,aGVsbG8=',
    bucket: 'open-merch-artwork',
    client,
  });

  assert.equal(
    result.publicUrl,
    'https://cdn.example.test/storage/open-merch-artwork/design-assets/asset_123.png'
  );
  assert.equal(result.path, 'design-assets/asset_123.png');
  assert.deepEqual(uploadCalls, [
    {
      bucket: 'open-merch-artwork',
      path: 'design-assets/asset_123.png',
      contentType: 'image/png',
      upsert: true,
    },
  ]);
});
