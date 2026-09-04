import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveDesignAllowance,
  designActionDenial,
  designAllowanceSource,
} from '../services/design-allowance.service.js';

test('allowance derivation and spend buckets agree for free and pass-backed drafts', () => {
  const free = deriveDesignAllowance(
    { id: 'session_free', freeDraftsUsed: 2, freeDraftLimit: 3 },
    undefined,
    false
  );
  assert.equal(free.freeDraftsRemaining, 1);
  assert.equal(free.studioPassStatus, 'not_required');
  assert.equal(designAllowanceSource('rough_draft', free), 'free_draft');
  assert.equal(designActionDenial('rough_draft', free), undefined);

  const passBacked = deriveDesignAllowance(
    { id: 'session_pass', freeDraftsUsed: 3, freeDraftLimit: 3 },
    {
      status: 'purchased',
      includedRoughDrafts: 8,
      roughDraftsUsed: 1,
      includedEdits: 2,
      editsUsed: 2,
      includedFinals: 1,
      finalsUsed: 0,
    },
    true
  );
  assert.equal(passBacked.roughDraftsRemaining, 7);
  assert.equal(passBacked.editsRemaining, 0);
  assert.equal(designAllowanceSource('rough_draft', passBacked), 'rough_draft');
  assert.match(designActionDenial('edit', passBacked) ?? '', /No generated edits remain/);
});

test('exhausted allowance selects the configured recovery path', () => {
  const session = { id: 'session_done', freeDraftsUsed: 3, freeDraftLimit: 3 };
  const withoutPass = deriveDesignAllowance(session, undefined, false);
  const withPassOffer = deriveDesignAllowance(session, undefined, true);

  assert.equal(withoutPass.nextAction, 'checkout');
  assert.equal(withPassOffer.nextAction, 'buy_studio_pass');
  assert.match(designActionDenial('rough_draft', withoutPass) ?? '', /No more generated drafts/);
});
