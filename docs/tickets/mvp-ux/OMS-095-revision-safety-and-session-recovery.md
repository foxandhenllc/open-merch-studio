# OMS-095: Revision Safety And Guest-Session Recovery

**Status:** Implemented for MVP (2026-07-12)
**Priority:** P0  
**MVP timing:** Before external paid beta  
**Visibility:** Public  
**Critical path:** Yes  
**Supersedes/remediates:** OMS-043 acceptance gaps; OMS-050 session-resume gaps

## Goal

Protect the last valid design and make guest work resumable across blocked edits, refreshes, and Stripe redirects.

## User Value

Customers can experiment without losing paid/generated work, spending an edit they did not intend, or receiving a false success message.

## Confirmed Current Failure

- A free session has zero edits, but `Apply edit` is enabled.
- The backend returns a success-shaped mock draft with `id: null` when editing is unauthorized.
- The frontend replaces the valid draft with that response, clears mockups, announces success, and changes provider badges to fixture.
- Prompt edits do not invalidate a previously refined prompt.
- The revision textarea contains default instructions before the user types.
- Refresh starts a new guest session and loses product, prompt, draft, mockup, and quote state.
- A blocked placeholder can still display a quote and checkout form, although backend checkout validation prevents a Stripe Session.

## Requirements

### Non-destructive authorization

- Return an explicit non-2xx error or typed blocked result for unauthorized edits; never return a `DesignDraft` placeholder.
- Check `editsRemaining` before enabling or submitting the edit action.
- Keep the last valid draft, selected mockup, and cached product mockups unchanged after any blocked/failed edit.
- Announce the blocked outcome accurately and place the Studio Pass action beside it.

### Prompt and revision intent

- Clear or invalidate `idea` whenever the editable prompt changes after refinement.
- Initialize revision instructions as empty with a useful placeholder.
- Require explicit user-entered instructions before an edit can be submitted.
- Label MVP revisions as a regenerated variation, not a precise image edit.

### Resume and recovery

- Persist the guest session ID, selected product/variant/placement/orientation, prompt, valid design ID, selected mockup view, and quote ID locally.
- Rehydrate authoritative draft/quote/order records from the backend; do not trust cached client policy/readiness values for checkout.
- Clear expired or invalid references with a specific recovery message.
- Preserve the session across Stripe success and cancel redirects.
- Provide `Undo to previous draft` or explicit draft selection before any revision replaces the displayed current version.

### Quote and checkout integrity

- Do not offer quote/checkout UI when there is no valid design asset with passing readiness/policy state.
- Preserve the backend validation already blocking invalid artwork.
- Consolidate blocked-artwork messaging above the next action.

## Acceptance Criteria

- Clicking edit with zero allowance never changes the current artwork, mockup, provider state, or quote.
- The edit button is disabled or replaced by the Studio Pass CTA before submission when allowance is zero.
- Changing the prompt after refinement causes generation to use the visible prompt unless the user explicitly re-applies refinement.
- Revision instructions start empty.
- Reloading after a valid draft restores the same guest session, product selection, prompt, artwork, and available saved mockups.
- Stripe success/cancel returns restore the same session context.
- Invalid/blocked artwork cannot display an actionable checkout form.
- Failed revisions retain at least one selectable prior valid draft.

## Test Plan

- Unit test unauthorized revision returns a typed block/error and does not create a draft.
- Frontend test zero-edit state keeps the last valid design and mockup.
- Frontend test changing prompt clears stale refined prompt.
- E2E test generate → mockup → blocked edit → valid artwork remains.
- E2E test refresh and Stripe cancel restore the session.
- Integration test quote/checkout reject missing, blocked, and non-ready design assets.

## Source Anchors

- `backend/src/services/design.service.ts`
- `backend/src/services/runtime-store.ts`
- `frontend/src/studio-view-model.ts`
- `frontend/src/components/AllowanceMeter.tsx`
- [Audit evidence](../../audits/2026-07-12-designer-claims/README.md)

## Dependencies And Risks

- Coordinate with OMS-052/OMS-054 so checkout return state and session restoration use the same order reference.
- Never store provider secrets or payment details in browser persistence.
- Server policy/readiness remains authoritative even when client state is restored.

## Implementation Notes

- Unauthorized revisions now return a typed `409 revision_allowance_required` response and cannot replace the current draft, mockup, quote, or provider state.
- The workbench prevents empty or unavailable revisions, labels them as regenerated variations, retains draft history, and offers undo.
- Versioned guest state persists only safe identifiers and customer inputs; draft and quote records are rehydrated from authoritative server endpoints.
- Invalid saved references are cleared with a specific recovery message, and checkout remains gated on current server-backed artwork readiness.
