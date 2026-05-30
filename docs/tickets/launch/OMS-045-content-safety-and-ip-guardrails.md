# OMS-045: Content Safety And IP Guardrails

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-05: AI Design System  
**Critical path:** Yes

## Goal
Add clear policy and product controls for unsafe, infringing, or unsuitable merch requests.

## User Value
Customers get early guidance when an idea cannot be responsibly generated or fulfilled.

## Current State
No formal content or IP guardrail flow is documented or implemented.

## Requirements
- Define disallowed content categories for generated designs and fulfillment submissions.
- Add checks before generation, before finalization, and before fulfillment.
- Give customers neutral redirect copy when an idea is blocked.
- Log decision category and appeal/support path without storing unnecessary sensitive content.

## Implementation Notes
- Create shared policy helpers used by idea, draft, revision, and checkout flows.
- Add fixture cases for blocked and allowed requests.
- Document that users are responsible for rights to uploaded artwork.

## Interfaces/Data Changes
- Design endpoints return policy status and customer-safe message.
- Checkout blocks unresolved policy flags.

## Acceptance Criteria
- Unsafe or clearly infringing prompts are blocked before generation.
- Uploaded artwork path includes rights acknowledgement before checkout.
- Policy flags are visible to admins for order review.
- Allowed requests are not over-blocked in fixture tests.

## Test Plan
- Unit test policy classification fixtures.
- E2E test blocked prompt flow.
- E2E test upload rights acknowledgement.

## Dependencies/Blockers
- OMS-041
- OMS-042
- OMS-052.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Minimize retention of sensitive user-provided content while preserving necessary order audit data.

## Launch Risk Notes
Weak guardrails create fulfillment, legal, and platform-policy risk.
