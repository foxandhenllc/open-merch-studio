import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDesignDraft,
  getDesignDraftById,
  reviseDesignDraft,
} from '../services/design.service.js';
import { getDraft, getOrCreateSession } from '../services/runtime-store.js';

test('pass-free revision creates an edited asset and consumes one remaining draft', async () => {
  const session = getOrCreateSession(`sess_revision_safety_${Date.now()}`);
  const draft = await createDesignDraft('An original high-contrast garden fox badge', {
    sessionId: session.id,
    placementCodes: ['front'],
  });
  assert.ok(draft.id);
  assert.equal(draft.allowance.freeDraftsRemaining, 2);
  const restored = await getDesignDraftById(draft.id, session.id);
  assert.equal(restored?.id, draft.id);
  assert.equal(restored?.allowance.freeDraftsRemaining, 2);

  const revised = await reviseDesignDraft({
    draftId: draft.id as string,
    instructions: 'Make the fox larger',
    sessionId: session.id,
  });
  assert.ok(revised.id);
  assert.notEqual(revised.id, draft.id);
  assert.equal(revised.sourceType, 'edited');
  assert.equal(revised.allowance.freeDraftsRemaining, 1);
  assert.equal(getDraft(draft.id)?.id, draft.id);
});

test('pass-free beta sessions include three bounded drafts', async () => {
  const session = getOrCreateSession(`sess_beta_allowance_${Date.now()}`);
  const drafts = [];
  for (let index = 0; index < 3; index += 1) {
    drafts.push(
      await createDesignDraft(`Original beta draft ${index + 1} with enough detail`, {
        sessionId: session.id,
        placementCodes: ['front'],
      })
    );
  }

  assert.deepEqual(
    drafts.map((draft) => draft.allowance.freeDraftsRemaining),
    [2, 1, 0]
  );
  assert.ok(drafts.every((draft) => draft.id));
  assert.equal(drafts[2].allowance.nextAction, 'checkout');
  assert.doesNotMatch(drafts[2].allowance.message, /studio pass/i);

  const blocked = await createDesignDraft('A fourth beta draft should remain blocked', {
    sessionId: session.id,
    placementCodes: ['front'],
  });
  assert.equal(blocked.id, null);
  assert.equal(blocked.allowance.freeDraftsRemaining, 0);
});
