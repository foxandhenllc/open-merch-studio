import type { AllowanceState } from '../types/catalog.js';

export type DesignAllowanceAction = 'idea' | 'rough_draft' | 'edit' | 'final' | 'review' | 'mockup';

export type DesignAllowanceSource = 'free_draft' | 'rough_draft' | 'edit' | 'final' | 'none';

type SessionAllowanceSnapshot = {
  id: string;
  freeDraftsUsed: number;
  freeDraftLimit: number;
};

type PassAllowanceSnapshot = {
  status: string;
  includedRoughDrafts: number;
  includedEdits: number;
  includedFinals: number;
  roughDraftsUsed: number;
  editsUsed: number;
  finalsUsed: number;
};

/**
 * Derives the customer-visible allowance from either runtime or persisted
 * records. Keeping this arithmetic pure prevents fixture and live PostgreSQL
 * authorization paths from drifting apart.
 */
export function deriveDesignAllowance(
  session: SessionAllowanceSnapshot,
  pass: PassAllowanceSnapshot | null | undefined,
  studioPassEnabled: boolean
): AllowanceState {
  const freeDraftsRemaining = Math.max(0, session.freeDraftLimit - session.freeDraftsUsed);
  const roughDraftsRemaining = pass
    ? Math.max(0, pass.includedRoughDrafts - pass.roughDraftsUsed)
    : 0;
  const editsRemaining = pass ? Math.max(0, pass.includedEdits - pass.editsUsed) : 0;
  const finalsRemaining = pass ? Math.max(0, pass.includedFinals - pass.finalsUsed) : 0;
  const studioPassStatus = pass
    ? pass.status === 'applied'
      ? 'applied'
      : roughDraftsRemaining || editsRemaining || finalsRemaining
        ? 'available'
        : 'exhausted'
    : freeDraftsRemaining
      ? 'not_required'
      : 'required';

  return {
    sessionId: session.id,
    studioPassStatus,
    freeDraftsRemaining,
    roughDraftsRemaining,
    editsRemaining,
    finalsRemaining,
    nextAction:
      studioPassStatus === 'required' || studioPassStatus === 'exhausted'
        ? studioPassEnabled
          ? 'buy_studio_pass'
          : 'checkout'
        : 'continue_free',
    message:
      studioPassStatus === 'required'
        ? studioPassEnabled
          ? 'A $5 Studio Pass unlocks deeper drafting and applies to an eligible purchase.'
          : 'You have used the three free drafts included with this studio session.'
        : studioPassStatus === 'exhausted'
          ? studioPassEnabled
            ? 'This Studio Pass allowance is used. Checkout or contact support for more design help.'
            : 'Continue with your current artwork or contact support for more design help.'
          : `${freeDraftsRemaining} free draft${freeDraftsRemaining === 1 ? '' : 's'} remaining.`,
  };
}

export function designActionDenial(
  action: DesignAllowanceAction,
  allowance: AllowanceState
): string | undefined {
  if (
    action === 'rough_draft' &&
    allowance.freeDraftsRemaining <= 0 &&
    allowance.roughDraftsRemaining <= 0
  ) {
    return 'No more generated drafts remain for this design session.';
  }
  if (action === 'edit' && allowance.editsRemaining <= 0) {
    return 'No generated edits remain for this design session.';
  }
  if (action === 'final' && allowance.finalsRemaining <= 0) {
    return 'No final generations remain for this design session.';
  }
  return undefined;
}

export function designAllowanceSource(
  action: DesignAllowanceAction,
  allowance: AllowanceState
): DesignAllowanceSource {
  if (action === 'rough_draft') {
    return allowance.freeDraftsRemaining > 0 ? 'free_draft' : 'rough_draft';
  }
  if (action === 'edit') return 'edit';
  if (action === 'final') return 'final';
  return 'none';
}
