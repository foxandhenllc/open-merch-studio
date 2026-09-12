import assert from 'node:assert/strict';
import test from 'node:test';
import { imageUsageReceipt } from '../services/image-usage.js';
import { upgradeLegacyImageModel } from '../admin/image-models.js';

const usage = {
  input_tokens: 3000,
  input_tokens_details: { text_tokens: 1000, image_tokens: 2000 },
  output_tokens: 1000,
  total_tokens: 4000,
};
test('both 2.5 models account only for validated token counts at the reviewed uncached rates', () => {
  for (const model of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
    const receipt = imageUsageReceipt(model, { ...usage, raw_private_payload: 'must-not-persist' });
    assert.equal(receipt?.estimatedCostCents, 6); // $0.051, rounded up to cents for the budget.
    assert.equal(receipt?.costBasis, 'uncached-token-upper-estimate');
    assert.ok(!JSON.stringify(receipt).includes('raw_private_payload'));
    for (const invalid of [
      null,
      {},
      { ...usage, total_tokens: 3 },
      { ...usage, output_tokens: -1 },
      { ...usage, input_tokens: '3000' },
    ])
      assert.equal(imageUsageReceipt(model, invalid), null);
  }
  assert.equal(imageUsageReceipt('unknown', usage), null);
});
test('only the retired Image 2 alias and snapshots are migrated to Flare', () => {
  assert.equal(upgradeLegacyImageModel('gpt-image-2'), 'gpt-image-2.5-flare');
  assert.equal(upgradeLegacyImageModel('gpt-image-2-2026-04-21'), 'gpt-image-2.5-flare');
  assert.equal(upgradeLegacyImageModel('gpt-image-2.5-sunburst'), 'gpt-image-2.5-sunburst');
  assert.equal(upgradeLegacyImageModel('unknown'), 'unknown');
});
