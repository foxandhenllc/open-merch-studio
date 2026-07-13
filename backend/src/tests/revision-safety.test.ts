import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDesignDraft,
  getDesignDraftById,
  reviseDesignDraft,
} from '../services/design.service.js';
import { getDraft, getOrCreateSession } from '../services/runtime-store.js';
import { HttpError } from '../middleware.js';

test('unauthorized revision returns a typed conflict and preserves the valid draft', async () => {
  const session = getOrCreateSession(`sess_revision_safety_${Date.now()}`);
  const draft = await createDesignDraft('An original high-contrast garden fox badge', {
    sessionId: session.id,
    placementCodes: ['front'],
  });
  assert.ok(draft.id);
  assert.equal(draft.allowance.freeDraftsRemaining, 0);
  const before = getDraft(draft.id);
  const restored = await getDesignDraftById(draft.id, session.id);
  assert.equal(restored?.id, draft.id);
  assert.equal(restored?.allowance.freeDraftsRemaining, 0);

  await assert.rejects(
    () =>
      reviseDesignDraft({
        draftId: draft.id as string,
        instructions: 'Make the fox larger',
        sessionId: session.id,
      }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.errorCode, 'revision_allowance_required');
      return true;
    }
  );

  assert.deepEqual(getDraft(draft.id), before);
});
