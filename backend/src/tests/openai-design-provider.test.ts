import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrintReadyPrompt,
  normalizePromptForPrint,
} from '../services/openai-design-provider.js';

test('print prompt builder removes product mockup language and keeps requested text explicit', () => {
  assert.equal(normalizePromptForPrint('a sunrise badge on a t-shirt mockup'), 'a sunrise badge');
  const prompt = buildPrintReadyPrompt('a bold badge that says "Launch Crew" for a hoodie');
  assert.match(prompt, /Launch Crew/);
  assert.match(prompt, /correctly spelled/);
  assert.match(prompt, /not a product photo/);
});
