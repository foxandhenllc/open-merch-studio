import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrintReadyPrompt,
  createMockDesignImage,
  dataUrlToBuffer,
  normalizePromptForPrint,
  supportsInputFidelity,
  supportsTransparentBackground,
} from '../services/openai-design-provider.js';

test('print prompt builder removes product mockup language and keeps requested text explicit', () => {
  assert.equal(normalizePromptForPrint('a sunrise badge on a t-shirt mockup'), 'a sunrise badge');
  const prompt = buildPrintReadyPrompt('a bold badge that says "Launch Crew" for a hoodie');
  assert.match(prompt, /Launch Crew/);
  assert.match(prompt, /correctly spelled/);
  assert.match(prompt, /not a product photo/);
});

test('fixture SVG data URLs decode with their charset parameter intact', () => {
  const image = createMockDesignImage('Fixture preview');
  const decoded = dataUrlToBuffer(image.imageUrl);
  assert.equal(decoded?.contentType, 'image/svg+xml');
  assert.match(decoded?.buffer.toString('utf8') ?? '', /Fixture preview/);
});

test('transparent output is requested only from compatible GPT Image models', () => {
  assert.equal(supportsTransparentBackground('gpt-image-1.5'), true);
  assert.equal(supportsTransparentBackground('gpt-image-1'), true);
  assert.equal(supportsTransparentBackground('gpt-image-2'), false);
  assert.equal(supportsTransparentBackground('gpt-image-2-2026-04-21'), false);
});

test('input fidelity is omitted for GPT Image 2 edit requests', () => {
  assert.equal(supportsInputFidelity('gpt-image-1.5'), true);
  assert.equal(supportsInputFidelity('gpt-image-1'), true);
  assert.equal(supportsInputFidelity('gpt-image-2'), false);
  assert.equal(supportsInputFidelity('gpt-image-2-2026-04-21'), false);
});
