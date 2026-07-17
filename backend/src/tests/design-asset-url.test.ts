import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDesignAssetProviderUrl } from '../utils/design-asset-url.js';

const params = (storedUrl: string, assetId = 'asset-123') => ({
  assetId,
  storedUrl,
  backendUrl: 'https://openmerchstudio.com/',
});

test('legacy OMS production asset URLs are rebased to the configured backend', () => {
  assert.equal(
    resolveDesignAssetProviderUrl(
      params('https://open-merch-studio-vercel-output.vercel.app/api/design/assets/asset-123.png')
    ),
    'https://openmerchstudio.com/api/design/assets/asset-123.png'
  );
});

test('legacy OMS preview asset URLs are rebased only when the route matches the asset', () => {
  assert.equal(
    resolveDesignAssetProviderUrl(
      params(
        'https://open-merch-studio-vercel-output-git-main-rat-benetar-team.vercel.app/api/design/assets/art%20one.png',
        'art one'
      )
    ),
    'https://openmerchstudio.com/api/design/assets/art%20one.png'
  );

  const differentAssetUrl =
    'https://open-merch-studio-vercel-output.vercel.app/api/design/assets/asset-999.png';
  assert.equal(resolveDesignAssetProviderUrl(params(differentAssetUrl)), differentAssetUrl);
});

test('unrelated external URLs remain unchanged', () => {
  const urls = [
    'https://files.cdn.printful.com/artwork/asset-123.png',
    'https://another-app.vercel.app/generated/asset-123.png',
    'https://another-app.vercel.app/api/design/assets/asset-123.png',
    'https://open-merch-studio-evil.vercel.app/api/design/assets/asset-123.png',
    'https://cdn.example.com/api/design/assets/asset-123.png',
    'https://open-merch-studio.vercel.app.evil.example/api/design/assets/asset-123.png',
  ];

  for (const storedUrl of urls) {
    assert.equal(resolveDesignAssetProviderUrl(params(storedUrl)), storedUrl);
  }
});

test('embedded artwork uses the configured first-party asset endpoint', () => {
  assert.equal(
    resolveDesignAssetProviderUrl(params('data:image/png;base64,YWJj')),
    'https://openmerchstudio.com/api/design/assets/asset-123.png'
  );
});

test('invalid or non-http stored URLs are rejected', () => {
  assert.equal(resolveDesignAssetProviderUrl(params('')), null);
  assert.equal(resolveDesignAssetProviderUrl(params('not a url')), null);
  assert.equal(resolveDesignAssetProviderUrl(params('ftp://example.com/asset.png')), null);
});
