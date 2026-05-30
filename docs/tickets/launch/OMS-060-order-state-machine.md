# OMS-060: Order State Machine

**Status:** Ready  
**Visibility:** Public  
**Epic:** EPIC-06: Commerce Accounts And Orders  
**Critical path:** Yes

## Goal
Define reliable order states from quote through payment, fulfillment, shipment, cancellation, and failure.

## User Value
Customers and operators see consistent status instead of ambiguous order records.

## Current State
The schema has order concepts, but a complete paid beta state machine is not yet documented and enforced.

## Requirements
- Define states for draft, quoted, checkout pending, paid, fulfillment validating, submitted, in production, shipped, delivered, cancelled, refunded, failed, and needs review.
- Define allowed transitions and who or what can trigger them.
- Make webhook and provider updates idempotent.
- Record timestamps and reason codes for material state changes.

## Implementation Notes
- Implement a state transition service instead of ad hoc order updates.
- Use transition guards for payment, readiness, payload validation, and provider submission.
- Expose customer-safe status labels separate from internal states.

## Interfaces/Data Changes
- Order service exposes transition methods.
- Webhooks and admin actions call the same transition service.

## Acceptance Criteria
- Invalid state transitions are rejected and logged.
- Duplicate webhooks do not create duplicate transitions.
- Customer status labels are accurate and understandable.
- Admin order history shows material transitions.

## Test Plan
- Unit test allowed and rejected transitions.
- Webhook idempotency test.
- Admin history display test.

## Dependencies/Blockers
- OMS-052
- OMS-034.

## Source Anchors
- Internal project direction and current Open Merch Studio repo state.

## Public Safety/Privacy Notes
Customer-facing order status should not reveal provider internals or debug codes.

## Launch Risk Notes
Weak state handling causes duplicate fulfillment or paid orders stuck in unknown states.
