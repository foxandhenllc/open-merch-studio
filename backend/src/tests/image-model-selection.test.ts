import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { withStoreSettings } from '../admin/store-settings.js';
import {
  generateDesignImage,
  editDesignImage,
  supportsInputFidelity,
  supportsTransparentBackground,
} from '../services/openai-design-provider.js';
import { prepareArtworkForPrint } from '../services/background-removal.service.js';

test('selected 2.5 model reaches generation and reference/edit requests with PNG transparency and without unsupported fidelity', async () => {
  const original = { key: env.openaiApiKey, live: env.enableLiveOpenAi, fetch: globalThis.fetch };
  env.openaiApiKey = 'fixture-openai-key';
  env.enableLiveOpenAi = true;
  const image = await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  const requests: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/moderations'))
      return Response.json({ results: [{ flagged: false, categories: {} }] });
    const request = new Request(url, init);
    if (request.headers.get('content-type')?.includes('application/json'))
      requests.push((await request.json()) as Record<string, unknown>);
    else requests.push(Object.fromEntries(await request.formData()));
    return Response.json({ data: [{ b64_json: image.toString('base64') }] });
  };
  try {
    for (const imageModel of ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare']) {
      await withStoreSettings(
        { imageModel, dailyAiBudgetCents: 2500, perSessionBudgetCents: 800, freeDraftLimit: 3 },
        async () => {
          await generateDesignImage({
            prompt: 'A bold sunrise',
            sessionId: 'fixture-session',
            qualityTier: 'rough',
          });
          for (const mode of ['reference', 'edit'] as const)
            await editDesignImage({
              prompt: 'Make the sun orange',
              sessionId: 'fixture-session',
              qualityTier: 'final',
              mode,
              images: [{ buffer: image, contentType: 'image/png', filename: 'fixture.png' }],
            });
        }
      );
      for (const request of requests.splice(0)) {
        assert.equal(request.model, imageModel);
        assert.equal(request.background, 'transparent');
        assert.equal(request.output_format, 'png');
        assert.equal(request.size, '1024x1024');
        assert.equal(request.input_fidelity, undefined);
        assert.match(String(request.prompt), /transparent background/);
      }
      assert.equal(supportsTransparentBackground(`${imageModel}-2026-09-08`), true);
      assert.equal(supportsInputFidelity(`${imageModel}-2026-09-08`), false);
    }
  } finally {
    globalThis.fetch = original.fetch;
    env.openaiApiKey = original.key;
    env.enableLiveOpenAi = original.live;
  }
});

test('native transparency requires actual transparent pixels, not just a model name or alpha channel', async () => {
  const original = env.removeBgApiKey;
  const originalFetch = globalThis.fetch;
  let networkRequests = 0;
  globalThis.fetch = async () => {
    networkRequests += 1;
    throw new Error('Unexpected network request in a native-transparency test.');
  };
  env.removeBgApiKey = undefined;
  try {
    for (const alpha of [0, 1]) {
      const image = await sharp({
        create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha } },
      })
        .png()
        .toBuffer();
      const result = await prepareArtworkForPrint({
        imageUrl: `data:image/png;base64,${image.toString('base64')}`,
        model: 'gpt-image-2.5-sunburst',
      });
      assert.equal(result.status, alpha === 0 ? 'transparent' : 'required');
    }
    env.removeBgApiKey = 'fixture-removal-key';
    const invalid = await prepareArtworkForPrint({
      imageUrl: 'data:image/png;base64,bm90YW5pbWFnZQ==',
      model: 'gpt-image-2.5-flare',
    });
    assert.equal(invalid.status, 'required');
    assert.equal(supportsTransparentBackground('unknown-image-provider'), false);
    assert.equal(networkRequests, 0);
  } finally {
    env.removeBgApiKey = original;
    globalThis.fetch = originalFetch;
  }
});
