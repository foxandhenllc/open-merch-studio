import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { withStoreSettings } from '../admin/store-settings.js';
import {
  generateDesignImage,
  ImageRequestNotSentError,
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
    return Response.json({
      data: [{ b64_json: image.toString('base64') }],
      usage: {
        input_tokens: 20,
        input_tokens_details: { text_tokens: 20, image_tokens: 0 },
        output_tokens: 1000,
        total_tokens: 1020,
      },
    });
  };
  try {
    for (const imageModel of ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare']) {
      await withStoreSettings(
        { imageModel, dailyAiBudgetCents: 2500, perSessionBudgetCents: 800, freeDraftLimit: 3 },
        async () => {
          const generated = await generateDesignImage({
            prompt: 'A bold sunrise',
            sessionId: 'fixture-session',
            qualityTier: 'rough',
          });
          assert.equal(generated.usage?.estimatedCostCents, 4);
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
  const original = process.env.REMOVE_BG_API_KEY;
  const originalFetch = globalThis.fetch;
  let networkRequests = 0;
  globalThis.fetch = async () => {
    networkRequests += 1;
    throw new Error('Unexpected network request in a native-transparency test.');
  };
  process.env.REMOVE_BG_API_KEY = undefined;
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
    process.env.REMOVE_BG_API_KEY = 'fixture-removal-key';
    const invalid = await prepareArtworkForPrint({
      imageUrl: 'data:image/png;base64,bm90YW5pbWFnZQ==',
      model: 'gpt-image-2.5-flare',
    });
    assert.equal(invalid.status, 'required');
    assert.equal(supportsTransparentBackground('unknown-image-provider'), false);
    assert.equal(networkRequests, 0);
  } finally {
    process.env.REMOVE_BG_API_KEY = original;
    globalThis.fetch = originalFetch;
  }
});

test('generation distinguishes an unstarted image request from a failed provider request', async () => {
  const previous = { ...env },
    fetch = globalThis.fetch;
  Object.assign(env, {
    openaiApiKey: 'fixture-key',
    enableLiveOpenAi: true,
    openaiDesignModel: 'gpt-image-2.5-flare',
  });
  let imageCalls = 0,
    flagged = true;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/moderations'))
      return Response.json({ results: [{ flagged, categories: {} }] });
    imageCalls++;
    return Response.json(
      { error: { message: 'Fixture request rejected', type: 'invalid_request_error' } },
      { status: 400 }
    );
  };
  try {
    const generate = () =>
      generateDesignImage({
        prompt: 'A sunrise',
        sessionId: 'fixture-session',
        qualityTier: 'rough',
      });
    await assert.rejects(generate, ImageRequestNotSentError);
    assert.equal(imageCalls, 0);
    flagged = false;
    await assert.rejects(generate, (error) => !(error instanceof ImageRequestNotSentError));
    assert.equal(imageCalls, 1);
  } finally {
    Object.assign(env, previous);
    globalThis.fetch = fetch;
  }
});
