# OMS-063: Fulfillment Failure Recovery

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-07: Admin Observability And Ops  
**Critical path:** Yes

## Goal
Define and implement recovery paths for order, provider, payment, mockup, and readiness failures.

## User Value
Customers can be helped quickly when an order cannot proceed automatically.

## Current State
Failure recovery is not yet modeled across commerce and fulfillment flows.

## Requirements
- Classify failure types as customer action needed, operator review needed, retryable provider issue, payment issue, and unrecoverable order issue.
- Add retry and override actions only where safe.
- Notify customers when their action is needed.
- Keep an operator audit trail of recovery actions.

## Implementation Notes
- Extend order state machine with needs-review reason codes.
- Add admin actions for retry, cancel, refund referral, and customer contact.
- Use fixture failures to test recovery without live provider calls.

## Interfaces/Data Changes
- Order state reason codes.
- Admin failure recovery actions.
- Customer notifications for action-needed states.

## Acceptance Criteria
- Retryable failures can be retried exactly through approved paths.
- Unrecoverable failures move to clear support action states.
- Customers are not told an order is progressing when it is blocked.
- Operator recovery actions are visible in order history.

## Test Plan
- Unit test failure classification.
- Integration test retryable provider failure.
- E2E test order moves to customer action needed.

## Dependencies/Blockers
- OMS-060
- OMS-061
- OMS-062.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Do not automate refunds or re-submissions without clear idempotency and operator review where needed.

## Launch Risk Notes
Failure recovery gaps can convert isolated provider issues into customer-facing chaos.
