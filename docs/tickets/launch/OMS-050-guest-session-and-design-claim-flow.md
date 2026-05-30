# OMS-050: Guest Session And Design Claim Flow

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal
Let customers start designing without an account and claim their work later if needed.

## User Value
The studio stays low-friction while still supporting saved designs and order continuity.

## Current State
The scaffold does not yet have durable customer session or claim behavior.

## Requirements
- Create guest studio sessions with selected product, drafts, quote, and pass state.
- Allow a guest to claim a session during account creation or checkout.
- Expire abandoned guest sessions according to retention policy.
- Prevent one user from claiming another user session.

## Implementation Notes
- Add session identifiers stored in secure cookies or equivalent server-managed session state.
- Associate design assets and quotes with session IDs before account ownership exists.
- Add claim logic when auth is introduced.

## Interfaces/Data Changes
- Studio APIs accept or derive session identity.
- Account flow can attach session records to a user.

## Acceptance Criteria
- A guest can start design and reach quote without creating an account.
- A guest can claim the design before checkout or after pass purchase.
- Session ownership checks prevent cross-session access.
- Expired sessions cannot be used for checkout.

## Test Plan
- Integration test guest session creation.
- Security test session ownership checks.
- E2E test guest design then claim.

## Dependencies/Blockers
- OMS-012
- OMS-020.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not expose session identifiers in public URLs unless they are scoped and revocable.

## Launch Risk Notes
Bad session handling can lose customer work or leak private designs.
